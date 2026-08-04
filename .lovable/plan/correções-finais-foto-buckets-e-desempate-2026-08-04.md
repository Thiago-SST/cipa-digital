# Correções finais: foto, buckets e desempate

## 1. Bug da foto na autoinscrição (correção rápida)

Em `uploadMyCandidacyPhoto` a busca da candidatura passa a filtrar também pela eleição atual (a que está com inscrições abertas), igual ao que `getMyCandidacy` já faz. Se não houver candidatura naquela eleição, o envio é recusado com mensagem clara, em vez de alterar a foto de uma candidatura antiga.

## 2. Status dos buckets

Verificado: os dois buckets já existem no projeto e ambos estão **privados**:

- `candidate-photos` — privado
- `election-documents` — privado

Nada a criar. Sobre incluir a criação em migration SQL: o backend bloqueia `INSERT INTO storage.buckets` por migration — buckets só podem ser criados pela ferramenta de storage da plataforma. O que fica versionado em SQL são as políticas de acesso sobre os arquivos, que já estão. Para não depender de memória, adiciono uma seção curta em `README.md` listando os buckets necessários e suas configurações.

## 3. Desempate por maior tempo de casa

Critério escolhido: em caso de empate em votos, vence quem tem mais tempo de empresa.

Como isso exige um dado que ainda não existe:

- Nova coluna `data_admissao` (data, opcional) em `employees`.
- Campo "Data de admissão" no cadastro/edição de empregado e na importação CSV (coluna opcional; registros sem o dado continuam válidos).
- Exibição da data de admissão na lista de empregados.

Nova ordem de classificação na apuração:

1. Mais votos
2. Admissão mais antiga (maior tempo de casa)
3. Inscrição mais antiga (só quando a admissão é desconhecida ou idêntica)
4. Menor número de cédula

Onde aparece:

- Ranking da apuração e do acompanhamento ao vivo.
- Ata/PDF: quando houver empate real em votos, o texto passa a declarar qual critério resolveu o empate, com a data de admissão dos envolvidos — assim a decisão fica explícita e auditável, em vez de silenciosa.
- Aviso na tela de apuração quando um empate for decidido por admissão e algum dos empatados estiver sem data cadastrada, indicando que o dado precisa ser preenchido.

## Detalhes técnicos

- `src/lib/voter.functions.ts`: `uploadMyCandidacyPhoto` resolve a eleição em `registration` e filtra `election_id` + `employee_id`.
- Migration: `ALTER TABLE public.employees ADD COLUMN data_admissao date` (sem alterar RLS/grants existentes).
- `src/lib/results.server.ts`: seleciona `employees(data_admissao)` via `employee_id` do candidato, aplica o comparador em cascata e retorna metadados de empate (`empate: true`, `criterio_desempate`) por candidato.
- `src/lib/admin.functions.ts`: a apuração hoje duplica a lógica de ranqueamento (por volta da linha 434) — passa a reusar `computeElectionResults`, evitando divergência entre apuração, monitor ao vivo e ata.
- `src/lib/ata-pdf.server.ts`: seção de empates quando houver.
- `src/routes/_authenticated/admin.empregados.tsx`: campo de admissão no formulário, coluna na tabela e mapeamento no CSV.
