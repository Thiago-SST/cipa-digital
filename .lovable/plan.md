## O que já está pronto

**Fluxo do eleitor (Fase 1)**
- Login por matrícula/CPF + data de nascimento
- Cédula com candidatos, confirmação e tela de voto registrado
- Voto anônimo, único por eleitor, com token e log de acesso

**Painel administrativo (Fase 2)**
- Auth de admin (email/senha) + bootstrap do primeiro admin + `user_roles` com RLS
- CRUD de eleições (status draft → registration → voting → closed)
- CRUD de candidatos (aprovação, número de cédula)
- CRUD de empregados + importação CSV
- Configuração de vagas titulares/suplentes por eleição
- Apuração com ranking, desempate NR-5, separação titular/suplente, banner de vagas em aberto
- Atas de apuração (geração, impressão, arquivamento) e listagem em `/admin/atas`
- Dashboard com métricas de comparecimento

---

## O que ainda falta do escopo original

### 1. Inscrição de candidatos pelo próprio empregado
Hoje só o admin cadastra candidatos. A NR-5 pressupõe inscrição voluntária durante o período de inscrição.
- Tela pública `/candidatar` (login de empregado + formulário: cargo, setor, proposta, foto opcional)
- Regras: só permitido quando a eleição está em `registration`, um empregado = uma candidatura, status inicial `pendente` para aprovação do admin
- Aviso na home para empregados durante o período de inscrição

### 2. Comunicação / notificações
Original pedia avisos aos eleitores.
- Envio de email em massa (abertura das inscrições, abertura da votação, encerramento) via Lovable Cloud + template
- Banner de "eleição aberta" na tela inicial do eleitor
- Opcional: reenvio de convite individual pelo admin

### 3. Auditoria e transparência
- Página `/admin/auditoria`: timeline de eventos (criação de eleição, aprovação de candidato, abertura/fechamento da votação, importação de eleitores, geração de ata) — já existe `access_logs`, falta uma tela e ampliar os eventos gravados
- Exportações: lista de votantes (quem votou, sem revelar em quem), lista de candidatos, resultado final em CSV
- Hash/assinatura da ata para prova de integridade

### 4. Documentos comprobatórios além da ata de apuração
Hoje só existe ata de apuração.
- Edital de convocação
- Ata de abertura da votação
- Ata de encerramento
- Upload manual de PDFs assinados (Storage bucket `election_documents`) vinculado à eleição

### 5. Ajustes no fluxo do eleitor
- Home `/votar` mostrar qual eleição está aberta (hoje o eleitor loga "no escuro")
- Bloquear login fora da janela `data_inicio_votacao` / `data_fim_votacao`
- Suporte a voto em branco / nulo (a NR-5 permite; hoje só há voto nominal)
- Opcional: múltiplos votos por eleitor quando houver mais de uma vaga (a norma clássica é 1 voto por eleitor, então confirmar antes)

### 6. Configurações globais
Original pedia "configurações da organização".
- Página `/admin/configuracoes`: nome da organização, CNPJ, logo, mandato (data início/fim), texto padrão do edital, vagas padrão sugeridas
- Usadas nos cabeçalhos das atas e no rodapé do sistema

### 7. Polimentos
- Recuperação de senha do admin
- Segundo perfil "organizador" (enum já existe) com permissões reduzidas (ver, não editar apuração)
- Testes básicos do fluxo de voto
- SEO/metadata das páginas públicas revisada

---

## Sugestão de próxima fase

Recomendo agrupar assim, em ordem de valor:

- **Fase 3** — Inscrição de candidatos pelo empregado + home do eleitor mostrando eleição ativa + janela de votação + voto branco/nulo
- **Fase 4** — Documentos comprobatórios (upload) + edital + ata de abertura/encerramento + exportações CSV + tela de auditoria
- **Fase 5** — Notificações por email + configurações da organização + perfil organizador + recuperação de senha

Me diga qual fase seguir (ou reordene os itens) e eu já começo.
