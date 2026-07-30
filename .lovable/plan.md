## Situação atual (verificada no código)

Já entregue e funcional:
- Fluxo do eleitor completo (login por matrícula/CPF + data de nascimento, cédula, voto nominal/branco/nulo, voto único por `vote_tokens`, anonimato).
- Painel admin: eleições (criar/editar/status/homologar/arquivar), candidatos (CRUD, número, aprovação), empregados (CRUD + importação CSV), comissão eleitoral, impugnações, avisos oficiais.
- Apuração com ranking e desempate NR-5, aba "Acompanhar" ao vivo, ata estruturada, documentos (upload de PDF no storage), exportações CSV, auditoria e configurações da organização.

## O que ainda falta do escopo inicial

1. **Foto do candidato** — existe o campo `foto_url`, exibido na cédula, mas não há upload de imagem em lugar nenhum. Hoje só dá para colar uma URL.
2. **Exclusão de eleição** — só existe arquivar; não há exclusão real (nem com proteção contra apagar eleição com votos).
3. **Geração de PDF das atas/relatórios** — a ata é salva como registro estruturado e os PDFs são enviados manualmente. Falta gerar o documento pronto (ata de apuração / resultado) para impressão e arquivo.
4. **Auditoria sem filtros** — a tela mostra os últimos 200 eventos sem busca, filtro por ação/período ou paginação.
5. **Notificações por email** — nada é disparado pela aplicação (só o email nativo de recuperação de senha).
6. **Perfil / gestão de organizadores** — não há tela para trocar a própria senha dentro do painel nem para conceder/remover o papel de organizador a outros usuários.

## Proposta de próxima etapa (Fase 6 — fechamento do escopo)

Sugiro fechar primeiro os itens que travam o uso real do sistema, nesta ordem:

**Bloco A — Documentos oficiais e candidatos**
- Upload de foto do candidato: novo bucket público de fotos, upload no formulário de candidato (admin) e na auto-candidatura, com preview e substituição.
- Geração de PDF da Ata de Apuração e do Relatório de Resultado, com cabeçalho da organização, comissão eleitoral, totais (nominais, brancos, nulos), ranking com titulares e suplentes e espaço de assinaturas. O PDF gerado fica salvo junto aos documentos da eleição.

**Bloco B — Administração**
- Exclusão de eleição com confirmação, bloqueada quando já houver votos registrados (nesse caso só arquivar).
- Auditoria com filtros (período, tipo de ação, busca por ator) e paginação, além de exportação CSV dos logs.
- Tela de perfil: trocar a própria senha e gerenciar quem é administrador/organizador.

**Bloco C — Notificações por email (opcional, precisa de decisão)**
- Emails automáticos em marcos do processo (publicação do edital, homologação de inscrições, abertura da votação, resultado). Requer definir o remetente e domínio de envio.

## Detalhes técnicos

- Fotos: novo bucket de storage com leitura pública e escrita restrita; server functions de upload em `src/lib/admin.functions.ts` e `src/lib/voter.functions.ts` (auto-candidatura), no mesmo padrão de `uploadElectionDocument`.
- PDF: geração no servidor com biblioteca compatível com o runtime edge (pdf-lib), salvando o arquivo no bucket `election-documents` e registrando em `election_documents`.
- Exclusão de eleição: nova server function com verificação de votos e registro em `access_logs`.
- Perfil/organizadores: leitura e escrita em `user_roles` restritas a admin, e troca de senha via auth do usuário logado.

Posso começar pelo Bloco A, ou prefere outra ordem?
