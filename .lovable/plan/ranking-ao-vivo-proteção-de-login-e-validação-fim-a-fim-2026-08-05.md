# Ranking ao vivo, proteção de login e validação fim a fim

## 1. Monitor ao vivo com o mesmo ranking da apuração

Hoje o painel "Acompanhar" ordena por votos e, no empate, pelo número da cédula — sem o critério de tempo de casa. Numa eleição apertada, o painel ao vivo pode mostrar uma ordem diferente da apuração oficial.

O monitor passa a reusar `computeElectionResults`, a mesma função que gera a apuração e a ata. Ele continua entregando tudo o que é exclusivo do acompanhamento: gráfico de votos por faixa de 5 minutos, últimos votos registrados, comparecimento e ritmo. Assim existe uma única regra de classificação no sistema.

Efeito visível: as posições e os selos de Titular/Suplente aparecem no painel ao vivo exatamente como aparecerão no resultado final.

## 2. Proteção contra tentativas repetidas no login do eleitor

Observação antes de implementar: o backend não tem um recurso pronto de limite de tentativas. A proteção será construída sob medida (uma tabela de tentativas no próprio banco). Funciona bem para o volume de uma eleição interna, mas é uma solução do app, não de infraestrutura.

Regra proposta:

- Conta tentativas erradas por IP e por identificador (matrícula/CPF) numa janela de 10 minutos.
- Após 5 erros no mesmo identificador, ou 10 erros vindos do mesmo IP, o login é bloqueado por 15 minutos com mensagem clara ("Muitas tentativas. Tente novamente em X minutos").
- Login bem-sucedido zera o contador daquele identificador.
- Toda tentativa bloqueada vira evento de auditoria (`voter.login.bloqueado`), com IP e identificador tentado, visível na tela de Auditoria e no CSV.
- A mesma proteção vale para o login da autoinscrição de candidato, que usa as mesmas credenciais.
- A mensagem de credencial inválida fica genérica, para não revelar se a matrícula existe.

Nenhuma data de nascimento é gravada em log.

## 3. Validação fim a fim com dados de homologação

Roteiro executado num conjunto de dados de teste (uma eleição de homologação, empregados fictícios com datas de admissão distintas e alguns em branco):

1. Importação de empregados por CSV, incluindo a coluna de data de admissão.
2. Autoinscrição pelo próprio empregado e cadastro de candidato pelo admin.
3. Upload de foto nos dois caminhos, com pré-visualização e recusa de arquivo inválido.
4. Aprovação/reprovação de candidatura e atribuição de números.
5. Abertura da votação, voto nominal, branco e nulo.
6. Tentativa de votar duas vezes com o mesmo empregado (deve ser recusada).
7. Tentativas erradas de login até o bloqueio, e liberação depois da janela.
8. Painel ao vivo comparado à apuração (mesma ordem, inclusive em empate provocado de propósito).
9. Geração do PDF da ata, conferindo a seção de empates e o critério declarado.
10. Auditoria: presença dos eventos de login, voto, bloqueio, aprovação e documentos.

Entrega: relatório do checklist com o resultado de cada item e correção de qualquer falha encontrada. Os dados de homologação ficam numa eleição marcada como teste — diga se prefere que eu exclua ao final ou deixe para inspeção.

## Detalhes técnicos

- `src/lib/admin.functions.ts`: `getElectionLiveMonitor` chama `computeElectionResults(sb, electionId)` e compõe o retorno com buckets/últimos votos calculados localmente; remove o `sort` inline.
- `src/routes/_authenticated/admin.eleicoes.$id.tsx`: `LiveMonitorTab` passa a ler `posicao`/`classificacao` do ranking unificado.
- Migration: tabela `public.login_attempts` (identificador normalizado, ip, sucesso, created_at) com índices por identificador+created_at e ip+created_at, RLS ativa, leitura só para admin, escrita via service role.
- `src/lib/voter.functions.ts`: helper `assertLoginAllowed()` antes da checagem de credenciais em `voterLogin` e no login da autoinscrição; grava tentativa e insere `access_logs` no bloqueio. IP lido de `x-forwarded-for`.
- Validação fim a fim conduzida via Playwright no preview + consultas ao banco, com seed de homologação por SQL.