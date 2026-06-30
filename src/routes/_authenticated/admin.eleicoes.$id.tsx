import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Play, Square, Plus, Trash2, Printer, Award, AlertTriangle, CheckCircle2 } from "lucide-react";

import {
  getElection,
  setElectionStatus,
  listCandidates,
  upsertCandidate,
  deleteCandidate,
  getElectionResults,
  saveAta,
  upsertElection,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/eleicoes/$id")({
  component: ElectionDetail,
});

type Tab = "detalhes" | "candidatos" | "apuracao" | "ata";

function ElectionDetail() {
  const { id } = Route.useParams();
  const [tab, setTab] = useState<Tab>("detalhes");

  const fnGet = useServerFn(getElection);
  const fnStatus = useServerFn(setElectionStatus);
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["admin-election", id], queryFn: () => fnGet({ data: { id } }) });
  const mStatus = useMutation({
    mutationFn: (status: "draft" | "registration" | "voting" | "closed") =>
      fnStatus({ data: { id, status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-election", id] }),
  });

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  const el = q.data!;

  return (
    <div className="space-y-6">
      <Link to="/admin/eleicoes" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Voltar
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{el.nome}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {el.vagas_titulares} titulares · {el.vagas_suplentes} suplentes · status atual:{" "}
            <strong>{el.status}</strong>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {el.status !== "voting" && (
            <button
              onClick={() => mStatus.mutate("voting")}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Play className="h-3.5 w-3.5" /> Abrir votação
            </button>
          )}
          {el.status === "voting" && (
            <button
              onClick={() => mStatus.mutate("closed")}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted"
            >
              <Square className="h-3.5 w-3.5" /> Encerrar votação
            </button>
          )}
          {el.status === "draft" && (
            <button
              onClick={() => mStatus.mutate("registration")}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted"
            >
              Abrir inscrições
            </button>
          )}
        </div>
      </header>

      <nav className="flex gap-1 border-b border-border">
        {(["detalhes", "candidatos", "apuracao", "ata"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`border-b-2 px-4 py-2 text-sm capitalize transition ${
              tab === t ? "border-primary font-semibold text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "apuracao" ? "Apuração" : t}
          </button>
        ))}
      </nav>

      {tab === "detalhes" && <DetailsTab el={el} />}
      {tab === "candidatos" && <CandidatesTab electionId={id} />}
      {tab === "apuracao" && <ResultsTab electionId={id} />}
      {tab === "ata" && <AtaTab electionId={id} />}
    </div>
  );
}

function DetailsTab({
  el,
}: {
  el: {
    id: string;
    nome: string;
    descricao: string | null;
    data_inicio_inscricao: string | null;
    data_fim_inscricao: string | null;
    data_inicio_votacao: string | null;
    data_fim_votacao: string | null;
    vagas_titulares: number;
    vagas_suplentes: number;
    status: string;
  };
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-5 text-sm">
        <dl className="grid gap-3 sm:grid-cols-2">
          <Info label="Descrição" value={el.descricao ?? "—"} />
          <Info label="Início da votação" value={fmt(el.data_inicio_votacao)} />
          <Info label="Fim da votação" value={fmt(el.data_fim_votacao)} />
        </dl>
      </div>
      <SeatsEditor el={el} />
    </div>
  );
}

function SeatsEditor({
  el,
}: {
  el: {
    id: string;
    nome: string;
    descricao: string | null;
    data_inicio_inscricao: string | null;
    data_fim_inscricao: string | null;
    data_inicio_votacao: string | null;
    data_fim_votacao: string | null;
    vagas_titulares: number;
    vagas_suplentes: number;
    status: string;
  };
}) {
  const fnUpsert = useServerFn(upsertElection);
  const qc = useQueryClient();
  const [titulares, setTitulares] = useState(el.vagas_titulares);
  const [suplentes, setSuplentes] = useState(el.vagas_suplentes);
  const locked = el.status === "voting" || el.status === "closed";

  const m = useMutation({
    mutationFn: () =>
      fnUpsert({
        data: {
          id: el.id,
          nome: el.nome,
          descricao: el.descricao,
          data_inicio_inscricao: el.data_inicio_inscricao,
          data_fim_inscricao: el.data_fim_inscricao,
          data_inicio_votacao: el.data_inicio_votacao,
          data_fim_votacao: el.data_fim_votacao,
          vagas_titulares: Number(titulares),
          vagas_suplentes: Number(suplentes),
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-election", el.id] });
      qc.invalidateQueries({ queryKey: ["admin-elections"] });
      qc.invalidateQueries({ queryKey: ["admin-results", el.id] });
    },
  });

  const dirty = titulares !== el.vagas_titulares || suplentes !== el.vagas_suplentes;

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Vagas da CIPA</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Define quantos titulares e suplentes serão eleitos. A apuração usa estes valores para
            separar a chapa eleita.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium">
          Vagas titulares
          <input
            type="number"
            min={1}
            max={50}
            disabled={locked}
            value={titulares}
            onChange={(e) => setTitulares(Number(e.target.value))}
            className={`${inputCls} mt-1 disabled:cursor-not-allowed disabled:opacity-60`}
          />
        </label>
        <label className="block text-xs font-medium">
          Vagas suplentes
          <input
            type="number"
            min={0}
            max={50}
            disabled={locked}
            value={suplentes}
            onChange={(e) => setSuplentes(Number(e.target.value))}
            className={`${inputCls} mt-1 disabled:cursor-not-allowed disabled:opacity-60`}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Total de eleitos: <strong>{Number(titulares) + Number(suplentes)}</strong>
        </p>
        <div className="flex items-center gap-2">
          {locked && (
            <span className="text-xs text-muted-foreground">
              Eleição {el.status === "voting" ? "em votação" : "encerrada"} — vagas bloqueadas.
            </span>
          )}
          {m.error && <span className="text-xs text-destructive">{(m.error as Error).message}</span>}
          {m.isSuccess && !dirty && <span className="text-xs text-primary">Vagas atualizadas.</span>}
          <button
            type="button"
            disabled={locked || !dirty || m.isPending}
            onClick={() => m.mutate()}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {m.isPending ? "Salvando..." : "Salvar vagas"}
          </button>
        </div>
      </div>
    </div>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-foreground">{value}</dd>
    </div>
  );
}
function fmt(d: string | null) {
  return d ? new Date(d).toLocaleString("pt-BR") : "—";
}

/* ============ CANDIDATOS ============ */
function CandidatesTab({ electionId }: { electionId: string }) {
  const fnList = useServerFn(listCandidates);
  const fnUpsert = useServerFn(upsertCandidate);
  const fnDelete = useServerFn(deleteCandidate);
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["admin-candidates", electionId], queryFn: () => fnList({ data: { electionId } }) });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-candidates", electionId] });

  const mUpsert = useMutation({
    mutationFn: (
      v: { id?: string; nome: string; matricula: string; setor?: string | null; cargo?: string | null; proposta?: string | null; numero?: number | null; status?: "pending" | "approved" | "rejected" },
    ) => fnUpsert({ data: { ...v, election_id: electionId } }),
    onSuccess: invalidate,
  });
  const mDelete = useMutation({ mutationFn: (id: string) => fnDelete({ data: { id } }), onSuccess: invalidate });

  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
          <Plus className="h-3.5 w-3.5" /> Novo candidato
        </button>
      </div>
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : !q.data?.length ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Nenhum candidato.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="py-2">Nº</th><th>Nome</th><th>Setor</th><th>Status</th><th />
            </tr>
          </thead>
          <tbody>
            {q.data.map((c) => (
              <tr key={c.id} className="border-b border-border/50">
                <td className="py-2 font-mono">{c.numero ?? "—"}</td>
                <td>
                  <div className="font-medium">{c.nome}</div>
                  <div className="text-xs text-muted-foreground">mat. {c.matricula}</div>
                </td>
                <td>{c.setor ?? "—"}</td>
                <td>
                  <select
                    value={c.status}
                    onChange={(e) =>
                      mUpsert.mutate({ id: c.id, nome: c.nome, matricula: c.matricula, setor: c.setor, cargo: c.cargo, proposta: c.proposta, numero: c.numero, status: e.target.value as "pending" | "approved" | "rejected" })
                    }
                    className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                  >
                    <option value="pending">Pendente</option>
                    <option value="approved">Aprovado</option>
                    <option value="rejected">Rejeitado</option>
                  </select>
                </td>
                <td className="text-right">
                  <button onClick={() => confirm(`Excluir ${c.nome}?`) && mDelete.mutate(c.id)} className="text-destructive hover:opacity-80">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {open && (
        <CandidateDialog
          onClose={() => setOpen(false)}
          onSubmit={(v) => mUpsert.mutate(v)}
          pending={mUpsert.isPending}
          error={mUpsert.error as Error | null}
        />
      )}
    </div>
  );
}

function CandidateDialog({
  onClose,
  onSubmit,
  pending,
  error,
}: {
  onClose: () => void;
  onSubmit: (v: { nome: string; matricula: string; setor: string | null; cargo: string | null; proposta: string | null; numero: number | null; status: "approved" }) => void;
  pending: boolean;
  error: Error | null;
}) {
  const [f, setF] = useState({ nome: "", matricula: "", setor: "", cargo: "", proposta: "", numero: "" });
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            nome: f.nome,
            matricula: f.matricula,
            setor: f.setor || null,
            cargo: f.cargo || null,
            proposta: f.proposta || null,
            numero: f.numero ? Number(f.numero) : null,
            status: "approved",
          });
        }}
        className="w-full max-w-md space-y-3 rounded-lg border border-border bg-card p-5 shadow-xl"
      >
        <h3 className="text-lg font-semibold">Novo candidato</h3>
        <input required placeholder="Nome" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} className={inputCls} />
        <div className="grid grid-cols-2 gap-2">
          <input required placeholder="Matrícula" value={f.matricula} onChange={(e) => setF({ ...f, matricula: e.target.value })} className={inputCls} />
          <input placeholder="Número na cédula" type="number" value={f.numero} onChange={(e) => setF({ ...f, numero: e.target.value })} className={inputCls} />
          <input placeholder="Setor" value={f.setor} onChange={(e) => setF({ ...f, setor: e.target.value })} className={inputCls} />
          <input placeholder="Cargo" value={f.cargo} onChange={(e) => setF({ ...f, cargo: e.target.value })} className={inputCls} />
        </div>
        <textarea rows={3} placeholder="Proposta" value={f.proposta} onChange={(e) => setF({ ...f, proposta: e.target.value })} className={inputCls} />
        {error && <p className="text-sm text-destructive">{error.message}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-sm">Cancelar</button>
          <button type="submit" disabled={pending} className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            {pending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ============ APURAÇÃO ============ */
function ResultsTab({ electionId }: { electionId: string }) {
  const fn = useServerFn(getElectionResults);
  const q = useQuery({ queryKey: ["admin-results", electionId], queryFn: () => fn({ data: { electionId } }) });

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Carregando apuração...</p>;
  const r = q.data!;
  const turnout = r.stats.eleitoresAptos ? Math.round((r.stats.eleitoresQueVotaram / r.stats.eleitoresAptos) * 100) : 0;
  const vagasTotais = r.stats.vagasTitulares + r.stats.vagasSuplentes;
  const tituPreenchidas = r.titulares.length;
  const supPreenchidas = r.suplentes.length;
  const tituFaltam = Math.max(0, r.stats.vagasTitulares - tituPreenchidas);
  const supFaltam = Math.max(0, r.stats.vagasSuplentes - supPreenchidas);
  const vagasAbertas = tituFaltam + supFaltam;
  const candidatosFaltantes = Math.max(0, vagasTotais - r.stats.candidatosAprovados);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Total de votos" value={r.stats.totalVotos} />
        <Stat label="Eleitores que votaram" value={`${r.stats.eleitoresQueVotaram} / ${r.stats.eleitoresAptos}`} />
        <Stat label="Comparecimento" value={`${turnout}%`} />
      </div>

      <VagasStatusBanner
        vagasTit={r.stats.vagasTitulares}
        vagasSup={r.stats.vagasSuplentes}
        tituPreenchidas={tituPreenchidas}
        supPreenchidas={supPreenchidas}
        tituFaltam={tituFaltam}
        supFaltam={supFaltam}
        vagasAbertas={vagasAbertas}
        vagasTotais={vagasTotais}
        candidatosAprovados={r.stats.candidatosAprovados}
        candidatosFaltantes={candidatosFaltantes}
        electionStatus={r.election.status}
      />

      <Section title={`Titulares eleitos (${r.titulares.length}/${r.stats.vagasTitulares})`} icon={Award}>
        {r.titulares.length ? <ResultsTable rows={r.titulares} /> : <p className="text-sm text-muted-foreground">Sem dados.</p>}
        {tituFaltam > 0 && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" />
            {tituFaltam} vaga(s) de titular em aberto — sem candidatos aprovados suficientes.
          </p>
        )}
      </Section>
      <Section title={`Suplentes (${r.suplentes.length}/${r.stats.vagasSuplentes})`}>
        {r.suplentes.length ? <ResultsTable rows={r.suplentes} /> : <p className="text-sm text-muted-foreground">Sem dados.</p>}
        {supFaltam > 0 && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" />
            {supFaltam} vaga(s) de suplente em aberto — sem candidatos aprovados suficientes.
          </p>
        )}
      </Section>
      <Section title="Ranking completo">
        <ResultsTable rows={r.ranking} showClass />
      </Section>

      <button
        onClick={() => window.print()}
        className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted"
      >
        <Printer className="h-3.5 w-3.5" /> Imprimir / PDF
      </button>
    </div>
  );
}
function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function VagasStatusBanner({
  vagasTit,
  vagasSup,
  tituPreenchidas,
  supPreenchidas,
  tituFaltam,
  supFaltam,
  vagasAbertas,
  vagasTotais,
  candidatosAprovados,
  candidatosFaltantes,
  electionStatus,
}: {
  vagasTit: number;
  vagasSup: number;
  tituPreenchidas: number;
  supPreenchidas: number;
  tituFaltam: number;
  supFaltam: number;
  vagasAbertas: number;
  vagasTotais: number;
  candidatosAprovados: number;
  candidatosFaltantes: number;
  electionStatus: string;
}) {
  const ok = vagasAbertas === 0;
  const tone = ok
    ? "border-primary/40 bg-primary/5"
    : "border-destructive/40 bg-destructive/5";
  const Icon = ok ? CheckCircle2 : AlertTriangle;
  const iconColor = ok ? "text-primary" : "text-destructive";

  return (
    <div className={`rounded-lg border ${tone} p-4`}>
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconColor}`} />
        <div className="flex-1">
          <h3 className="text-sm font-semibold">
            {ok
              ? "Todas as vagas foram preenchidas"
              : `${vagasAbertas} vaga(s) em aberto de ${vagasTotais}`}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Configuração: <strong className="text-foreground">{vagasTit}</strong> titular(es) e{" "}
            <strong className="text-foreground">{vagasSup}</strong> suplente(s). Candidatos aprovados:{" "}
            <strong className="text-foreground">{candidatosAprovados}</strong>.
          </p>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <VagaLine
              label="Titulares"
              preenchidas={tituPreenchidas}
              total={vagasTit}
              faltam={tituFaltam}
            />
            <VagaLine
              label="Suplentes"
              preenchidas={supPreenchidas}
              total={vagasSup}
              faltam={supFaltam}
            />
          </div>

          {!ok && (
            <div className="mt-3 rounded-md border border-destructive/30 bg-background/60 p-3 text-xs">
              <p className="font-semibold text-destructive">Atenção — vagas não preenchidas</p>
              <ul className="ml-4 mt-1 list-disc space-y-0.5 text-muted-foreground">
                {tituFaltam > 0 && (
                  <li>
                    <strong className="text-foreground">{tituFaltam}</strong> vaga(s) de{" "}
                    <strong>titular</strong> sem candidato eleito.
                  </li>
                )}
                {supFaltam > 0 && (
                  <li>
                    <strong className="text-foreground">{supFaltam}</strong> vaga(s) de{" "}
                    <strong>suplente</strong> sem candidato eleito.
                  </li>
                )}
                {candidatosFaltantes > 0 && (
                  <li>
                    Faltam <strong className="text-foreground">{candidatosFaltantes}</strong> candidato(s)
                    aprovado(s) para cobrir todas as vagas (mínimo necessário: {vagasTotais}).
                  </li>
                )}
              </ul>
              <p className="mt-2 text-muted-foreground">
                {electionStatus === "closed"
                  ? "Conforme a NR-5, registre o ocorrido na ata e mantenha o processo eleitoral para reabertura de inscrições das vagas remanescentes."
                  : electionStatus === "voting"
                    ? "Considere encerrar inscrições somente após confirmar candidatos suficientes, ou reabra inscrições antes da votação terminar."
                    : "Reabra as inscrições e aprove novos candidatos antes de iniciar a votação."}
              </p>
            </div>
          )}

          <p className="mt-3 text-[11px] text-muted-foreground">
            Critério de desempate: maior nº de votos → inscrição mais antiga → menor número de cédula (NR-5).
          </p>
        </div>
      </div>
    </div>
  );
}

function VagaLine({
  label,
  preenchidas,
  total,
  faltam,
}: {
  label: string;
  preenchidas: number;
  total: number;
  faltam: number;
}) {
  const pct = total === 0 ? 100 : Math.round((preenchidas / total) * 100);
  const ok = faltam === 0;
  return (
    <div className="rounded-md border border-border bg-card/60 p-2.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className={ok ? "text-primary" : "text-destructive"}>
          {preenchidas}/{total} {ok ? "✓" : `· faltam ${faltam}`}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full ${ok ? "bg-primary" : "bg-destructive"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
function Section({ title, icon: Icon, children }: { title: string; icon?: typeof Award; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">{Icon && <Icon className="h-4 w-4 text-primary" />} {title}</h3>
      {children}
    </section>
  );
}
function ResultsTable({
  rows,
  showClass = false,
}: {
  rows: Array<{
    id: string;
    nome: string;
    matricula: string;
    setor: string | null;
    numero: number | null;
    votos: number;
    posicao?: number;
    classificacao?: "titular" | "suplente" | "nao_eleito";
  }>;
  showClass?: boolean;
}) {
  return (
    <table className="w-full text-sm">
      <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
        <tr>
          <th className="py-1 w-10">#</th>
          <th className="w-12">Cédula</th>
          <th>Nome</th>
          <th>Setor</th>
          {showClass && <th>Classificação</th>}
          <th className="text-right">Votos</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((c) => (
          <tr key={c.id} className="border-b border-border/50">
            <td className="py-1.5 text-muted-foreground">{c.posicao ?? "—"}º</td>
            <td className="py-1.5 font-mono">{c.numero ?? "—"}</td>
            <td>{c.nome} <span className="text-xs text-muted-foreground">· mat. {c.matricula}</span></td>
            <td>{c.setor ?? "—"}</td>
            {showClass && (
              <td>
                {c.classificacao === "titular" && (
                  <span className="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                    Titular
                  </span>
                )}
                {c.classificacao === "suplente" && (
                  <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
                    Suplente
                  </span>
                )}
                {c.classificacao === "nao_eleito" && (
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    Não eleito
                  </span>
                )}
              </td>
            )}
            <td className="text-right font-semibold">{c.votos}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ============ ATAS ============ */
function AtaTab({ electionId }: { electionId: string }) {
  const fnResults = useServerFn(getElectionResults);
  const fnSave = useServerFn(saveAta);
  const r = useQuery({ queryKey: ["admin-results", electionId], queryFn: () => fnResults({ data: { electionId } }) });
  const m = useMutation({
    mutationFn: (input: { titulo: string; tipo: "abertura" | "apuracao" | "encerramento"; conteudo: Record<string, unknown> }) =>
      fnSave({ data: { electionId, ...input } }),
  });

  if (r.isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  const data = r.data!;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-6 print:border-0 print:shadow-none">
        <h2 className="text-xl font-semibold">Ata de apuração — {data.election.nome}</h2>
        <p className="mt-1 text-xs text-muted-foreground">Emitida em {new Date().toLocaleString("pt-BR")}</p>
        <p className="mt-4 text-sm leading-relaxed">
          Aos {new Date().toLocaleDateString("pt-BR")}, foi realizada a apuração da eleição da CIPA referente ao processo
          <strong> {data.election.nome}</strong>, com {data.stats.eleitoresQueVotaram} votantes de um total de {data.stats.eleitoresAptos} eleitores aptos.
          Foram preenchidas <strong>{data.election.vagas_titulares}</strong> vagas titulares e <strong>{data.election.vagas_suplentes}</strong> suplentes.
        </p>
        <h3 className="mt-5 text-sm font-semibold">Titulares</h3>
        <ol className="ml-5 list-decimal text-sm">{data.titulares.map((c) => <li key={c.id}>{c.nome} (mat. {c.matricula}) — {c.votos} votos</li>)}</ol>
        <h3 className="mt-3 text-sm font-semibold">Suplentes</h3>
        <ol className="ml-5 list-decimal text-sm">{data.suplentes.map((c) => <li key={c.id}>{c.nome} (mat. {c.matricula}) — {c.votos} votos</li>)}</ol>
      </div>
      <div className="flex flex-wrap gap-2 print:hidden">
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Printer className="h-3.5 w-3.5" /> Imprimir / PDF
        </button>
        <button
          onClick={() =>
            m.mutate({
              titulo: `Ata de apuração — ${data.election.nome}`,
              tipo: "apuracao",
              conteudo: {
                stats: data.stats,
                titulares: data.titulares,
                suplentes: data.suplentes,
                ranking: data.ranking,
                emitidaEm: new Date().toISOString(),
              },
            })
          }
          disabled={m.isPending}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-60"
        >
          {m.isPending ? "Arquivando..." : "Arquivar esta ata"}
        </button>
        {m.isSuccess && <span className="self-center text-xs text-primary">Ata arquivada.</span>}
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2";