# CIPA Digital

Desenvolva uma aplicação web completa para gerenciamento da eleição da CIPA (Comissão Interna de Prevenção de Acidentes e de Assédio), seguindo os requisitos abaixo:

Objetivo

Permitir que a organização realize todo o processo eleitoral da CIPA de forma digital, segura, transparente e auditável, desde a inscrição dos candidatos até a apuração dos votos.

Perfis de Usuário

Administrador

Gerenciar eleições.

Cadastrar e editar candidatos.

Importar lista de empregados via planilha Excel/CSV.

Definir período de inscrição de candidatos.

Definir período de votação.

Acompanhar participação em tempo real.

Encerrar votação.

Gerar relatórios e atas.

Visualizar resultados.

Eleitor

Realizar login utilizando matrícula funcional ou CPF.

Visualizar informações dos candidatos.

Votar uma única vez.

Receber confirmação do voto.

Funcionalidades

Dashboard Administrativo

Total de empregados aptos a votar.

Quantidade de candidatos inscritos.

Quantidade de votos registrados.

Percentual de participação.

Status da eleição (Não iniciada, Em andamento, Encerrada).

Cadastro de Candidatos

Campos:

Nome completo.

Matrícula.

Setor/Secretaria.

Cargo.

Foto.

Proposta ou apresentação.

Inscrição de Candidatos

Inscrição online.

Aprovação pelo administrador.

Possibilidade de anexar foto e proposta.

Processo de Votação

Interface simples e intuitiva.

Exibição da foto do candidato.

Nome do candidato.

Setor.

Breve descrição.

Confirmação antes do envio do voto.

Impedir múltiplos votos.

Segurança

Autenticação obrigatória.

Cada usuário pode votar apenas uma vez.

Registro de logs de acesso.

Registro de data e hora do voto.

Criptografia de dados sensíveis.

Controle de permissões por perfil.

Apuração

Contagem automática dos votos.

Ranking dos candidatos.

Identificação dos titulares e suplentes.

Critérios de desempate configuráveis.

Relatórios

Gerar PDF com:

Lista de candidatos.

Lista de votantes.

Resultado final.

Quantidade de votos por candidato.

Ata de eleição.

Ata de apuração.

Banco de Dados

Tabela Usuários:

id

nome

matrícula

cpf

email

senha

perfil

Tabela Candidatos:

id

nome

matrícula

setor

cargo

foto

proposta

status

Tabela Eleições:

id

nome

data_inicio

data_fim

status

Tabela Votos:

id

eleitor_id

candidato_id

data_hora

Tabela Logs:

id

usuário

ação

data_hora

Interface

Design moderno.

Responsivo para desktop e celular.

Tema institucional.

Menu lateral.

Dashboard com gráficos.

Tabelas com filtros e pesquisa.

Layout semelhante a sistemas corporativos governamentais.

Tecnologias

Frontend:

React

TypeScript

Tailwind CSS

Backend:

Supabase

Autenticação:

Supabase Auth

Relatórios:

Exportação PDF

Diferenciais

QR Code para acesso à votação.

Auditoria completa.

Exportação Excel.

Histórico de eleições anteriores.

Página pública de resultados após encerramento.

Possibilidade de configurar quantidade de vagas titulares e suplentes.

Resultado Esperado

Criar uma aplicação funcional com todas as telas, banco de dados, autenticação, fluxo completo de eleição da CIPA e interface pronta para uso em órgãos públicos e empresas privadas.

O sistema deve atender aos requisitos da NR-5, permitindo registrar candidatos, eleitores, atas, resultados e documentos comprobatórios do processo eleitoral para fins de fiscalização e auditoria

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2b85ece6-b2d3-43f9-b356-dc4cd9ba7598).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
