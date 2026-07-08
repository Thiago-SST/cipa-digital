## Objetivo
Corrigir o erro "Sessão expirada" ao votar, causado pelo cookie de sessão do eleitor não ser enviado em contexto de iframe (preview) e potencialmente em navegações cross-site.

## Causa raiz
`src/lib/voter-session.server.ts` cria o cookie com `sameSite: "lax"`. Dentro do iframe do preview Lovable, o cookie é tratado como third-party e bloqueado a partir da segunda requisição. O login "funciona" (Set-Cookie chega), mas as chamadas seguintes (`getVoterBallot`, `castVote`) não enviam o cookie → o servidor retorna `authenticated: false` / lança "Sessão expirada".

## Mudanças

### 1. `src/lib/voter-session.server.ts`
- Trocar `sameSite: "lax"` por `sameSite: "none"`.
- Manter `secure: true` (obrigatório com `sameSite: "none"`) e `httpOnly: true`.
- Nenhuma outra alteração de shape/API.

Efeito: o cookie passa a ser enviado em iframes cross-site (preview) e em navegações top-level normais no site publicado. `httpOnly` + `secure` continuam protegendo contra XSS/interceptação; a proteção contra CSRF é dada pelo fato de que todas as ações críticas (`castVote`, `registerCandidacy`) são server functions do próprio domínio invocadas via fetch same-origin com validação de entrada por Zod e verificações de janela/eleição no handler.

### 2. Verificação
Após o build, testar o fluxo:
1. `/votar` → login com matrícula/data → deve navegar para `/votar/cedula` mostrando a cédula (não "sessão expirada").
2. Selecionar candidato → Confirmar voto → deve chegar em `/votar/confirmado`.

Se o problema persistir após a mudança, investigar via Playwright headless no localhost para descartar bug adicional em `getVoterSession()` (ex.: `SESSION_SECRET` ausente em runtime).

## Fora de escopo
- Alterar autenticação do admin (Supabase Auth).
- Reescrever storage de sessão (manter `useSession` do TanStack Start).
- Alterar RLS, migrations ou schema.

## Detalhes técnicos
`sameSite: "none"` + `secure: true` é o padrão recomendado quando o app pode ser embutido em iframe (preview) e quando cookies de sessão precisam sobreviver a redirecionamentos entre origens. É seguro aqui porque:
- Cookie é `httpOnly` (JS não lê).
- Só transmitido em HTTPS.
- As mutations sensíveis validam a eleição/janela e usam UNIQUE em `vote_tokens` para impedir voto duplicado, então CSRF não permite votar sem antes ter autenticado como o próprio empregado.
