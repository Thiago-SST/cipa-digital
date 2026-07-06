# Estruturação completa do processo de eleição (NR-5)

Revisão do que existe versus o que a NR-5 exige, e implementação das peças faltantes para fechar o ciclo eleitoral de ponta a ponta.

## Estado atual (já pronto)

- Eleições com status `draft → registration → voting → closed`
- Cadastro/aprovação de candidatos, importação de eleitores, vagas titulares/suplentes
- Votação anônima, cédula, voto branco/nulo, janela de votação
- Apuração com ranking, desempate NR-5, ata de apuração
- Documentos anexos, exportações CSV, auditoria, configurações da organização
- Auth de admin, recuperação de senha, roles

## Peças NR-5 faltantes

O ciclo real da CIPA tem etapas formais que hoje não estão modeladas:

```text
Constituição da Comissão Eleitoral
        ↓
Publicação do Edital (mín. 60 dias antes do fim do mandato)
        ↓
Inscrições (mín. 15 dias)
        ↓
Homologação das inscrições  ← período de impugnação
        ↓
Votação (mín. 30 dias antes do fim do mandato)
        ↓
Apuração  ← lavratura de ata
        ↓
Homologação do resultado  ← período de recurso
        ↓
Posse dos eleitos (1 dia após o fim do mandato anterior)
        ↓
Arquivamento por 5 anos
```

## O que vou implementar

### 1. Comissão Eleitoral
Tabela `election_commission_members` (presidente, secretário, membros) vinculada à eleição, com nome, matrícula, papel e assinatura registrada em ata. Aba "Comissão" na tela da eleição.

### 2. Cronograma oficial e novos status
Ampliar o enum de status para refletir a NR-5:
`draft → published → registration → homologation → voting → counting → result_homologation → concluded`
Com datas obrigatórias por fase e validação de prazos mínimos (15 dias inscrição, 30 dias antes do fim do mandato para votação). Timeline visual na tela da eleição.

### 3. Edital de convocação
Gerador automático de edital em PDF a partir das configurações da organização + dados da eleição (mandato, prazos, número de vagas, comissão). Botão "Publicar edital" que muda status para `published` e registra data de publicação.

### 4. Impugnação de candidaturas
Após o fim das inscrições, período de impugnação: qualquer eleitor logado pode contestar uma candidatura (motivo textual). Tela admin para julgar (deferir/indeferir) antes de mudar para `voting`. Tabela `candidate_challenges`.

### 5. Homologação do resultado e recurso
Após apuração, período configurável para recurso. Admin marca "Resultado homologado" que congela ranking e libera geração da ata final e termo de posse.

### 6. Termo de posse
Gerador de termo de posse listando titulares e suplentes eleitos, com espaço para assinatura, data de posse e início do mandato. PDF anexado automaticamente aos documentos da eleição.

### 7. Ata de abertura e encerramento da votação
Geração automática ao mudar status `registration → voting` (abertura) e `voting → counting` (encerramento), com totalizadores parciais e registro dos mesários.

### 8. Notificações internas ao eleitor
Ao logar em `/votar`, o eleitor vê um feed com os avisos oficiais da eleição (edital publicado, homologação, resultado). Sem depender de email externo nesta fase.

### 9. Arquivamento
Marcador "arquivado" e exportação consolidada (ZIP com todos documentos + CSVs) preservando por 5 anos conforme NR-5.

## Detalhes técnicos

- Migração: novo enum `election_status`, tabelas `election_commission_members`, `candidate_challenges`, campos `data_publicacao_edital`, `data_homologacao_inscricoes`, `data_homologacao_resultado`, `data_posse` em `elections`
- Server functions em `src/lib/admin.functions.ts` para cada nova operação (createCommission, publishEdital, challengeCandidate, judgeChallenge, homologateResult, issueTermoPosse, generateArchiveBundle)
- Server function pública `challengeCandidate` em `voter.functions.ts` (usa sessão de eleitor existente)
- UI: nova aba "Processo" na tela `/admin/eleicoes/$id` com timeline clicável guiando o admin fase a fase; abas existentes (Candidatos, Documentos, Apuração) permanecem
- Geração de PDF: usar `jspdf` (já instalado) para edital, termo de posse, atas de abertura/encerramento
- RLS: mantém padrão atual (admin CRUD, eleitor leitura restrita)

## Fora do escopo desta fase
- Envio de email em massa (fica para uma fase de comunicação externa)
- Assinatura digital ICP-Brasil (usamos assinatura manual + upload de PDF assinado como já existe)
- App mobile
