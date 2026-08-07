import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PhotoPicker } from "@/components/photo-picker";
import { ArrowLeft, Play, Plus, Trash2, Printer, Award, AlertTriangle, CheckCircle2, Users, Gavel, Megaphone, ListChecks, Archive, Activity, RefreshCw, Pause } from "lucide-react";

import {
  getElection,
  setElectionStatus,
  listCandidates,
  upsertCandidate,
  deleteCandidate,
  uploadCandidatePhoto,
  removeCandidatePhoto,
  getElectionResults,
  saveAta,
  upsertElection,
  listAtas,
  uploadElectionDocument,
  getDocumentSignedUrl,
  deleteElectionDocument,
  exportElectionData,
  listCommission,
  upsertCommissionMember,
  deleteCommissionMember,
  listChallenges,
  judgeChallenge,
  listNotices,
  publishNotice,
  deleteNotice,
  homologateRegistrations,
  homologateResult,
  archiveElection,
  updateElectionMilestones,
  getElectionLiveMonitor,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/eleicoes/$id")({
  component: ElectionDetail,
});

type Tab =
  | "processo"
  | "detalhes"
  | "comissao"
  | "candidatos"
  | "impugnacoes"
  | "avisos"
  | "acompanhar"
  | "apuracao"
  | "ata"
  | "documentos";

type ElectionStatus =
  | "draft"
  | "published"
  | "registration"
  | "homologation"
  | "voting"
  | "counting"
  | "result_homologation"
  | "concluded"
  | "closed";

function ElectionDetail() {
  const { id } = Route.useParams();
  const [tab, setTab] = useState<Tab>("processo");

  const fnGet = useServerFn(getElection);
  const qc = useQueryClient();

  const q = useQuery({ queryKey: ["admin-election", id], queryFn: () => fnGet({ data: { id } }) });

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
            <strong>{statusLabel(el.status as ElectionStatus)}</strong>
            {el.arquivada ? " · arquivada" : ""}
          </p>
        </div>
        <QuickStatusActions
          id={id}
          status={el.status as ElectionStatus}
          onChanged={() => qc.invalidateQueries({ queryKey: ["admin-election", id] })}
        />
      </header>

      <nav className="flex flex-wrap gap-1 border-b border-border">
        {(
          [
            "processo",
            "detalhes",
            "comissao",
            "candidatos",
            "impugnacoes",
            "avisos",
            "acompanhar",
            "apuracao",
            "ata",
            "documentos",
          ] as Tab[]
        ).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`border-b-2 px-4 py-2 text-sm capitalize transition ${
              tab === t ? "border-primary font-semibold text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tabLabel(t)}
          </button>
        ))}
      </nav>

      {tab === "processo" && <ProcessoTab id={id} el={el} />}
      {tab === "detalhes" && <DetailsTab el={el} />}
      {tab === "comissao" && <CommissionTab electionId={id} />}
      {tab === "candidatos" && <CandidatesTab electionId={id} />}
      {tab === "impugnacoes" && <ChallengesTab electionId={id} />}
      {tab === "avisos" && <NoticesTab electionId={id} />}
      {tab === "acompanhar" && <LiveMonitorTab electionId={id} status={el.status as ElectionStatus} />}
      {tab === "apuracao" && <ResultsTab electionId={id} />}
      {tab === "ata" && <AtaTab electionId={id} />}
      {tab === "documentos" && <DocumentsTab electionId={id} />}
    </div>
  );
}

function tabLabel(t: Tab): string {
  const map: Record<Tab, string> = {
    processo: "Processo",
    detalhes: "Configurações",
    comissao: "Comissão",
    candidatos: "Candidatos",
    impugnacoes: "Impugnações",
    avisos: "Avisos",
    acompanhar: "Acompanhar",
    apuracao: "Apuração",
    ata: "Ata",
    documentos: "Documentos",
  };
  return map[t];
}

function statusLabel(s: ElectionStatus): string {
  const map: Record<ElectionStatus, string> = {
    draft: "Rascunho",
    published: "Edital publicado",
    registration: "Inscrições abertas",
    homologation: "Homologação de inscrições",
    voting: "Em votação",
    counting: "Em apuração",
    result_homologation: "Homologação do resultado",
    concluded: "Concluída",
    closed: "Encerrada",
  };
  return map[s] ?? s;
}

function QuickStatusActions({
  id,
  status,
  onChanged,
}: {
  id: string;
  status: ElectionStatus;
  onChanged: () => void;
}) {
  const fnStatus = useServerFn(setElectionStatus);
  const m = useMutation({
    mutationFn: (s: ElectionStatus) => fnStatus({ data: { id, status: s } }),
    onSuccess: onChanged,
  });
  const next = nextStatus(status);
  if (!next) return null;
  return (
    <button
      onClick={() => m.mutate(next.value)}
      disabled={m.isPending}
      className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
    >
      <Play className="h-3.5 w-3.5" /> {next.label}
    </button>
  );
}

function nextStatus(s: ElectionStatus): { value: ElectionStatus; label: string } | null {
  switch (s) {
    case "draft":
      return { value: "published", label: "Publicar edital" };
    case "published":
      return { value: "registration", label: "Abrir inscrições" };
    case "registration":
      return { value: "homologation", label: "Encerrar inscrições" };
    case "homologation":
      return { value: "voting", label: "Abrir votação" };
    case "voting":
      return { value: "counting", label: "Encerrar votação" };
    case "counting":
      return { value: "result_homologation", label: "Homologar resultado" };
    case "result_homologation":
      return { value: "concluded", label: "Concluir eleição" };
    default:
      return null;
  }
}

/* ============ PROCESSO (timeline) ============ */
const STEPS: Array<{ status: ElectionStatus; titulo: string; descricao: string }> = [
  { status: "draft", titulo: "1. Constituição e planejamento", descricao: "Cadastre a comissão eleitoral e defina o cronograma na aba Detalhes." },
  { status: "published", titulo: "2. Publicação do edital", descricao: "Publique o edital de convocação (mín. 45 dias antes do fim do mandato)." },
  { status: "registration", titulo: "3. Inscrições dos candidatos", descricao: "Empregados se auto-inscrevem em /candidatar ou você adiciona pela aba Candidatos." },
  { status: "homologation", titulo: "4. Homologação e impugnações", descricao: "Analise impugnações e aprove/rejeite candidaturas antes de abrir a votação." },
  { status: "voting", titulo: "5. Votação", descricao: "Voto secreto durante o período configurado. Acompanhe o comparecimento." },
  { status: "counting", titulo: "6. Apuração", descricao: "Contagem automática de votos e ranqueamento com desempate por tempo de casa (NR-5)." },
  { status: "result_homologation", titulo: "7. Homologação do resultado", descricao: "Congela o ranking, permite recursos e emissão da ata final." },
  { status: "concluded", titulo: "8. Posse e arquivamento", descricao: "Emita o termo de posse e arquive o processo (guarda mínima de 5 anos)." },
];

function ProcessoTab({
  id,
  el,
}: {
  id: string;
  el: {
    id: string;
    status: string;
    data_publicacao_edital?: string | null;
    data_homologacao_inscricoes?: string | null;
    data_homologacao_resultado?: string | null;
    mandato_inicio?: string | null;
    mandato_fim?: string | null;
    data_posse?: string | null;
    arquivada?: boolean;
  };
}) {
  const qc = useQueryClient();
  const homReg = useServerFn(homologateRegistrations);
  const homRes = useServerFn(homologateResult);
  const arch = useServerFn(archiveElection);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-election", id] });

  const currentIdx = STEPS.findIndex((s) => s.status === el.status);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Etapas do processo NR-5</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Avance status a status pelo botão do cabeçalho. Ações formais registram o marco temporal.
        </p>
        <ol className="mt-4 space-y-3">
          {STEPS.map((step, i) => {
            const done = i < currentIdx || (i === currentIdx && el.status === "concluded");
            const current = i === currentIdx;
            return (
              <li
                key={step.status}
                className={`flex gap-3 rounded-md border p-3 ${
                  current ? "border-primary bg-primary/5" : done ? "border-border bg-muted/30" : "border-dashed border-border"
                }`}
              >
                <div
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                    done ? "bg-primary text-primary-foreground" : current ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {done ? "✓" : i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{step.titulo}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{step.descricao}</div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Ações do processo</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={async () => {
              await homReg({ data: { id } });
              invalidate();
            }}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted"
          >
            <ListChecks className="mr-1 inline h-3.5 w-3.5" /> Homologar inscrições
          </button>
          <button
            onClick={async () => {
              await homRes({ data: { id } });
              invalidate();
            }}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted"
          >
            <Gavel className="mr-1 inline h-3.5 w-3.5" /> Homologar resultado
          </button>
          <button
            onClick={async () => {
              await arch({ data: { id, arquivada: !el.arquivada } });
              invalidate();
            }}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted"
          >
            <Archive className="mr-1 inline h-3.5 w-3.5" /> {el.arquivada ? "Reabrir arquivo" : "Arquivar processo"}
          </button>
        </div>
      </section>

    </div>
  );
}

/* ============ COMISSÃO ELEITORAL ============ */
function CommissionTab({ electionId }: { electionId: string }) {
  const listFn = useServerFn(listCommission);
  const upFn = useServerFn(upsertCommissionMember);
  const delFn = useServerFn(deleteCommissionMember);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["commission", electionId], queryFn: () => listFn({ data: { electionId } }) });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["commission", electionId] });

  const [nome, setNome] = useState("");
  const [matricula, setMatricula] = useState("");
  const [papel, setPapel] = useState<"presidente" | "secretario" | "membro">("membro");

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Users className="h-4 w-4 text-primary" /> Comissão eleitoral
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          A NR-5 exige comissão eleitoral responsável pela condução, presidida por representante do empregador.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!nome.trim()) return;
            await upFn({ data: { election_id: electionId, nome: nome.trim(), matricula: matricula.trim() || null, papel } });
            setNome("");
            setMatricula("");
            setPapel("membro");
            invalidate();
          }}
          className="mt-4 grid gap-3 sm:grid-cols-4"
        >
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" className={`${inputCls} sm:col-span-2`} required />
          <input value={matricula} onChange={(e) => setMatricula(e.target.value)} placeholder="Matrícula" className={inputCls} />
          <select value={papel} onChange={(e) => setPapel(e.target.value as typeof papel)} className={inputCls}>
            <option value="presidente">Presidente</option>
            <option value="secretario">Secretário</option>
            <option value="membro">Membro</option>
          </select>
          <div className="sm:col-span-4 flex justify-end">
            <button className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
              <Plus className="mr-1 inline h-3.5 w-3.5" /> Adicionar
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <ul className="divide-y divide-border text-sm">
          {(q.data ?? []).map((m) => (
            <li key={m.id} className="flex items-center justify-between py-2">
              <div>
                <div className="font-medium">{m.nome}</div>
                <div className="text-xs text-muted-foreground">
                  {m.papel} {m.matricula ? `· mat. ${m.matricula}` : ""}
                </div>
              </div>
              <button
                onClick={async () => {
                  if (!confirm("Remover membro?")) return;
                  await delFn({ data: { id: m.id } });
                  invalidate();
                }}
                className="text-xs text-destructive hover:underline"
              >
                <Trash2 className="mr-1 inline h-3 w-3" /> Remover
              </button>
            </li>
          ))}
          {q.data && q.data.length === 0 && (
            <li className="py-4 text-xs text-muted-foreground">Nenhum membro cadastrado.</li>
          )}
        </ul>
      </section>
    </div>
  );
}

/* ============ IMPUGNAÇÕES ============ */
function ChallengesTab({ electionId }: { electionId: string }) {
  const listFn = useServerFn(listChallenges);
  const judgeFn = useServerFn(judgeChallenge);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["challenges", electionId], queryFn: () => listFn({ data: { electionId } }) });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["challenges", electionId] });

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Gavel className="h-4 w-4 text-primary" /> Impugnações de candidaturas
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Eleitores podem impugnar candidaturas durante os períodos de inscrição e homologação. Julgue cada pedido antes de abrir a votação.
        </p>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        {q.data && q.data.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma impugnação registrada.</p>
        ) : (
          <ul className="divide-y divide-border">
            {(q.data ?? []).map((c: any) => (
              <li key={c.id} className="space-y-2 py-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">
                      Candidato: {c.candidates?.nome ?? "—"} (mat. {c.candidates?.matricula ?? "—"})
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Autor: {c.autor_nome} (mat. {c.autor_matricula}) · {new Date(c.created_at).toLocaleString("pt-BR")}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      c.decisao === "pendente"
                        ? "bg-amber-100 text-amber-800"
                        : c.decisao === "deferido"
                          ? "bg-destructive/15 text-destructive"
                          : "bg-primary/15 text-primary"
                    }`}
                  >
                    {c.decisao}
                  </span>
                </div>
                <p className="rounded-md bg-muted/40 p-2 text-xs">{c.motivo}</p>
                {c.justificativa && (
                  <p className="text-xs text-muted-foreground">
                    <strong>Justificativa:</strong> {c.justificativa}
                  </p>
                )}
                {c.decisao === "pendente" && (
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        const j = prompt("Justificativa do deferimento (opcional):") ?? "";
                        await judgeFn({ data: { id: c.id, decisao: "deferido", justificativa: j || null } });
                        invalidate();
                      }}
                      className="rounded-md border border-destructive/30 bg-background px-3 py-1 text-xs text-destructive hover:bg-destructive/10"
                    >
                      Deferir (invalidar candidatura)
                    </button>
                    <button
                      onClick={async () => {
                        const j = prompt("Justificativa do indeferimento (opcional):") ?? "";
                        await judgeFn({ data: { id: c.id, decisao: "indeferido", justificativa: j || null } });
                        invalidate();
                      }}
                      className="rounded-md border border-border bg-background px-3 py-1 text-xs hover:bg-muted"
                    >
                      Indeferir (manter candidatura)
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ============ AVISOS OFICIAIS ============ */
const NOTICE_TYPES = [
  ["edital", "Edital de convocação"],
  ["homologacao_inscricoes", "Homologação de inscrições"],
  ["abertura_votacao", "Abertura da votação"],
  ["encerramento_votacao", "Encerramento da votação"],
  ["resultado", "Divulgação do resultado"],
  ["homologacao_resultado", "Homologação do resultado"],
  ["posse", "Convocação para posse"],
  ["geral", "Comunicado geral"],
] as const;

function NoticesTab({ electionId }: { electionId: string }) {
  const listFn = useServerFn(listNotices);
  const pubFn = useServerFn(publishNotice);
  const delFn = useServerFn(deleteNotice);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["notices", electionId], queryFn: () => listFn({ data: { electionId } }) });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["notices", electionId] });

  const [tipo, setTipo] = useState<(typeof NOTICE_TYPES)[number][0]>("geral");
  const [titulo, setTitulo] = useState("");
  const [corpo, setCorpo] = useState("");
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Megaphone className="h-4 w-4 text-primary" /> Publicar aviso oficial
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Avisos aparecem no portal do eleitor em /votar e servem como registro público do processo.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setErr(null);
            try {
              await pubFn({ data: { election_id: electionId, tipo, titulo, corpo } });
              setTitulo("");
              setCorpo("");
              invalidate();
            } catch (x) {
              setErr((x as Error).message);
            }
          }}
          className="mt-4 space-y-3"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} className={inputCls}>
              {NOTICE_TYPES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Título"
              className={`${inputCls} sm:col-span-2`}
              required
            />
          </div>
          <textarea
            value={corpo}
            onChange={(e) => setCorpo(e.target.value)}
            placeholder="Conteúdo do aviso"
            rows={5}
            className={inputCls}
            required
          />
          {err && <p className="text-xs text-destructive">{err}</p>}
          <div className="flex justify-end">
            <button className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
              Publicar
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h3 className="text-sm font-semibold">Avisos publicados</h3>
        <ul className="mt-3 divide-y divide-border text-sm">
          {(q.data ?? []).map((n) => (
            <li key={n.id} className="space-y-1 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{n.titulo}</div>
                  <div className="text-xs text-muted-foreground">
                    {n.tipo} · {new Date(n.publicado_em).toLocaleString("pt-BR")}
                  </div>
                </div>
                <button
                  onClick={async () => {
                    if (!confirm("Remover aviso?")) return;
                    await delFn({ data: { id: n.id } });
                    invalidate();
                  }}
                  className="text-xs text-destructive hover:underline"
                >
                  Remover
                </button>
              </div>
              <p className="whitespace-pre-wrap text-xs text-muted-foreground">{n.corpo}</p>
            </li>
          ))}
          {q.data && q.data.length === 0 && (
            <li className="py-4 text-xs text-muted-foreground">Nenhum aviso.</li>
          )}
        </ul>
      </section>
    </div>
  );
}

function DocumentsTab({ electionId }: { electionId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listAtas);
  const upFn = useServerFn(uploadElectionDocument);
  const urlFn = useServerFn(getDocumentSignedUrl);
  const delFn = useServerFn(deleteElectionDocument);
  const exportFn = useServerFn(exportElectionData);

  const q = useQuery({
    queryKey: ["election-docs", electionId],
    queryFn: () => listFn({ data: { electionId } }),
  });

  const [tipo, setTipo] = useState<"edital" | "abertura" | "encerramento" | "outro">("edital");
  const [titulo, setTitulo] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError("Selecione um arquivo.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Arquivo maior que 8 MB.");
      return;
    }
    setPending(true);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = "";
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      const fileBase64 = btoa(bin);
      await upFn({
        data: {
          electionId,
          tipo,
          titulo: titulo || file.name,
          fileName: file.name,
          fileBase64,
          mimeType: file.type || "application/octet-stream",
        },
      });
      setTitulo("");
      setFile(null);
      (document.getElementById("doc-file") as HTMLInputElement | null)?.value &&
        ((document.getElementById("doc-file") as HTMLInputElement).value = "");
      qc.invalidateQueries({ queryKey: ["election-docs", electionId] });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function openDoc(path: string) {
    const { url } = await urlFn({ data: { path } });
    window.open(url, "_blank", "noopener");
  }

  async function exportCsv(kind: "candidatos" | "votantes" | "resultado") {
    const { csv, filename } = await exportFn({ data: { electionId, kind } });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Enviar documento assinado (PDF)</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Edital de convocação, ata de abertura, ata de encerramento e demais comprovantes.
        </p>
        <form onSubmit={handleUpload} className="mt-4 grid gap-3 sm:grid-cols-4">
          <label className="sm:col-span-1">
            <span className="text-xs text-muted-foreground">Tipo</span>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as typeof tipo)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="edital">Edital</option>
              <option value="abertura">Ata de abertura</option>
              <option value="encerramento">Ata de encerramento</option>
              <option value="outro">Outro</option>
            </select>
          </label>
          <label className="sm:col-span-2">
            <span className="text-xs text-muted-foreground">Título</span>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Edital 001/2026"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="sm:col-span-1">
            <span className="text-xs text-muted-foreground">Arquivo</span>
            <input
              id="doc-file"
              type="file"
              accept="application/pdf,image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1 w-full text-xs"
            />
          </label>
          {error && (
            <p className="sm:col-span-4 text-xs text-destructive">{error}</p>
          )}
          <div className="sm:col-span-4 flex justify-end">
            <button
              disabled={pending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {pending ? "Enviando..." : "Enviar"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Documentos e atas arquivados</h2>
        <ul className="mt-3 divide-y divide-border text-sm">
          {(q.data ?? []).map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div>
                <div className="font-medium text-foreground">{d.titulo}</div>
                <div className="text-xs text-muted-foreground">
                  {d.tipo} · {new Date(d.created_at).toLocaleString("pt-BR")}
                  {d.file_name ? ` · ${d.file_name}` : ""}
                </div>
              </div>
              <div className="flex gap-2">
                {d.file_path && (
                  <button
                    onClick={() => openDoc(d.file_path!)}
                    className="rounded-md border border-border bg-background px-3 py-1 text-xs hover:bg-muted"
                  >
                    Abrir
                  </button>
                )}
                <button
                  onClick={async () => {
                    if (!confirm("Remover este documento?")) return;
                    await delFn({ data: { id: d.id } });
                    qc.invalidateQueries({ queryKey: ["election-docs", electionId] });
                  }}
                  className="rounded-md border border-destructive/30 bg-background px-3 py-1 text-xs text-destructive hover:bg-destructive/10"
                >
                  Remover
                </button>
              </div>
            </li>
          ))}
          {q.data && q.data.length === 0 && (
            <li className="py-4 text-xs text-muted-foreground">Nenhum documento.</li>
          )}
        </ul>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Exportar dados (CSV)</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Listas úteis para auditoria e fiscalização. Não expõem em quem cada eleitor votou.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => exportCsv("candidatos")}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted"
          >
            Candidatos
          </button>
          <button
            onClick={() => exportCsv("votantes")}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted"
          >
            Votantes (quem compareceu)
          </button>
          <button
            onClick={() => exportCsv("resultado")}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted"
          >
            Resultado consolidado
          </button>
        </div>
      </section>
    </div>
  );
}

type ElectionDetailData = {
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
  data_publicacao_edital?: string | null;
  data_homologacao_inscricoes?: string | null;
  data_homologacao_resultado?: string | null;
  mandato_inicio?: string | null;
  mandato_fim?: string | null;
  data_posse?: string | null;
};

function DetailsTab({ el }: { el: ElectionDetailData }) {
  return (
    <div className="space-y-4">
      <GeneralEditor el={el} />
      <SeatsEditor el={el} />
      <TimelineEditor el={el} />
    </div>
  );
}

function GeneralEditor({ el }: { el: ElectionDetailData }) {
  const fnUpsert = useServerFn(upsertElection);
  const qc = useQueryClient();
  const toLocal = (v: string | null | undefined) => (v ? new Date(v).toISOString().slice(0, 16) : "");
  const [form, setForm] = useState({
    nome: el.nome,
    descricao: el.descricao ?? "",
    data_inicio_inscricao: toLocal(el.data_inicio_inscricao),
    data_fim_inscricao: toLocal(el.data_fim_inscricao),
    data_inicio_votacao: toLocal(el.data_inicio_votacao),
    data_fim_votacao: toLocal(el.data_fim_votacao),
  });

  const m = useMutation({
    mutationFn: () =>
      fnUpsert({
        data: {
          id: el.id,
          nome: form.nome,
          descricao: form.descricao || null,
          data_inicio_inscricao: form.data_inicio_inscricao || null,
          data_fim_inscricao: form.data_fim_inscricao || null,
          data_inicio_votacao: form.data_inicio_votacao || null,
          data_fim_votacao: form.data_fim_votacao || null,
          vagas_titulares: el.vagas_titulares,
          vagas_suplentes: el.vagas_suplentes,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-election", el.id] });
      qc.invalidateQueries({ queryKey: ["admin-elections"] });
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        m.mutate();
      }}
      className="rounded-lg border border-border bg-card p-5"
    >
      <h3 className="text-sm font-semibold">Dados gerais</h3>
      <p className="mt-1 text-xs text-muted-foreground">Nome, descrição e as janelas de inscrição e votação.</p>

      <div className="mt-4 grid gap-3">
        <label className="block text-xs font-medium">
          Nome da eleição
          <input
            required
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            className={`${inputCls} mt-1`}
          />
        </label>
        <label className="block text-xs font-medium">
          Descrição
          <textarea
            rows={2}
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            className={`${inputCls} mt-1`}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium">
            Início das inscrições
            <input
              type="datetime-local"
              value={form.data_inicio_inscricao}
              onChange={(e) => setForm({ ...form, data_inicio_inscricao: e.target.value })}
              className={`${inputCls} mt-1`}
            />
          </label>
          <label className="block text-xs font-medium">
            Fim das inscrições
            <input
              type="datetime-local"
              value={form.data_fim_inscricao}
              onChange={(e) => setForm({ ...form, data_fim_inscricao: e.target.value })}
              className={`${inputCls} mt-1`}
            />
          </label>
          <label className="block text-xs font-medium">
            Início da votação
            <input
              type="datetime-local"
              value={form.data_inicio_votacao}
              onChange={(e) => setForm({ ...form, data_inicio_votacao: e.target.value })}
              className={`${inputCls} mt-1`}
            />
          </label>
          <label className="block text-xs font-medium">
            Fim da votação
            <input
              type="datetime-local"
              value={form.data_fim_votacao}
              onChange={(e) => setForm({ ...form, data_fim_votacao: e.target.value })}
              className={`${inputCls} mt-1`}
            />
          </label>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {m.error && <span className="text-xs text-destructive">{(m.error as Error).message}</span>}
        {m.isSuccess && <span className="text-xs text-primary">Dados atualizados.</span>}
        <button
          type="submit"
          disabled={m.isPending}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {m.isPending ? "Salvando..." : "Salvar dados gerais"}
        </button>
      </div>
    </form>
  );
}

function TimelineEditor({ el }: { el: ElectionDetailData }) {
  const qc = useQueryClient();
  const fn = useServerFn(updateElectionMilestones);
  const homReg = useServerFn(homologateRegistrations);
  const homRes = useServerFn(homologateResult);
  const [mi, setMi] = useState(el.mandato_inicio ?? "");
  const [mf, setMf] = useState(el.mandato_fim ?? "");
  const [dp, setDp] = useState(el.data_posse ?? "");
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-election", el.id] });

  const m = useMutation({
    mutationFn: () =>
      fn({ data: { id: el.id, mandato_inicio: mi || null, mandato_fim: mf || null, data_posse: dp || null } }),
    onSuccess: invalidate,
  });
  const reg = useMutation({ mutationFn: () => homReg({ data: { id: el.id } }), onSuccess: invalidate });
  const res = useMutation({ mutationFn: () => homRes({ data: { id: el.id } }), onSuccess: invalidate });

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h3 className="text-sm font-semibold">Linha do tempo da eleição</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Marcos formais e datas de mandato. As homologações são ações que registram o marco no momento em que são
        executadas.
      </p>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <Info label="Publicação do edital" value={fmt(el.data_publicacao_edital ?? null)} />
        <Info label="Início das inscrições" value={fmt(el.data_inicio_inscricao)} />
        <Info label="Fim das inscrições" value={fmt(el.data_fim_inscricao)} />
        <Info label="Homologação das inscrições" value={fmt(el.data_homologacao_inscricoes ?? null)} />
        <Info label="Início da votação" value={fmt(el.data_inicio_votacao)} />
        <Info label="Fim da votação" value={fmt(el.data_fim_votacao)} />
        <Info label="Homologação do resultado" value={fmt(el.data_homologacao_resultado ?? null)} />
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={reg.isPending}
          onClick={() => reg.mutate()}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-60"
        >
          <ListChecks className="mr-1 inline h-3.5 w-3.5" /> Registrar homologação das inscrições
        </button>
        <button
          type="button"
          disabled={res.isPending}
          onClick={() => res.mutate()}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-60"
        >
          <Gavel className="mr-1 inline h-3.5 w-3.5" /> Registrar homologação do resultado
        </button>
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mandato e posse</h4>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-medium">
            Início do mandato
            <input type="date" value={mi} onChange={(e) => setMi(e.target.value)} className={`${inputCls} mt-1`} />
          </label>
          <label className="text-xs font-medium">
            Fim do mandato
            <input type="date" value={mf} onChange={(e) => setMf(e.target.value)} className={`${inputCls} mt-1`} />
          </label>
          <label className="text-xs font-medium">
            Data da posse
            <input type="date" value={dp} onChange={(e) => setDp(e.target.value)} className={`${inputCls} mt-1`} />
          </label>
        </div>
        <div className="mt-3 flex items-center justify-end gap-2">
          {m.error && <span className="text-xs text-destructive">{(m.error as Error).message}</span>}
          <button
            type="button"
            onClick={() => m.mutate()}
            disabled={m.isPending}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {m.isPending ? "Salvando..." : "Salvar datas de mandato"}
          </button>
        </div>
      </div>
    </section>
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
  const fnUploadPhoto = useServerFn(uploadCandidatePhoto);
  const fnRemovePhoto = useServerFn(removeCandidatePhoto);
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
  const mPhoto = useMutation({
    mutationFn: async (v: { candidateId: string; file: File }) => {
      const { fileToBase64 } = await import("@/lib/file-to-base64");
      return fnUploadPhoto({
        data: {
          candidateId: v.candidateId,
          fileName: v.file.name,
          mimeType: v.file.type,
          fileBase64: await fileToBase64(v.file),
        },
      });
    },
    onSuccess: invalidate,
  });
  const mRemovePhoto = useMutation({
    mutationFn: (candidateId: string) => fnRemovePhoto({ data: { candidateId } }),
    onSuccess: invalidate,
  });

  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
          <Plus className="h-3.5 w-3.5" /> Novo candidato
        </button>
      </div>
      {mPhoto.error && <p className="text-sm text-destructive">{(mPhoto.error as Error).message}</p>}
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : !q.data?.length ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Nenhum candidato.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="py-2">Nº</th><th>Foto</th><th>Nome</th><th>Setor</th><th>Status</th><th />
            </tr>
          </thead>
          <tbody>
            {q.data.map((c) => (
              <tr key={c.id} className="border-b border-border/50">
                <td className="py-2 font-mono">{c.numero ?? "—"}</td>
                <td className="py-2">
                  <CandidatePhotoCell
                    nome={c.nome}
                    url={c.foto_display_url}
                    busy={
                      (mPhoto.isPending && mPhoto.variables?.candidateId === c.id) ||
                      (mRemovePhoto.isPending && mRemovePhoto.variables === c.id)
                    }
                    onSelect={(file) => mPhoto.mutate({ candidateId: c.id, file })}
                    onRemove={() => mRemovePhoto.mutate(c.id)}
                  />
                </td>
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

function CandidatePhotoCell({
  nome,
  url,
  busy,
  onSelect,
  onRemove,
}: {
  nome: string;
  url: string | null;
  busy: boolean;
  onSelect: (file: File) => void;
  onRemove: () => void;
}) {
  return (
    <PhotoPicker
      nome={nome}
      currentUrl={url}
      size={40}
      busy={busy}
      triggerLabel={url ? "Trocar" : "Enviar foto"}
      onConfirm={onSelect}
      onRemove={onRemove}
    />
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

      {r.empates.length > 0 && (
        <Section title="Empates e critério de desempate">
          <p className="text-xs text-muted-foreground">
            Ordem aplicada: mais votos → maior tempo de casa (admissão mais antiga) → inscrição mais antiga → menor número de cédula.
          </p>
          <ul className="mt-3 space-y-3">
            {r.empates.map((e) => (
              <li key={e.votos} className="rounded-md border border-border bg-muted/40 p-3">
                <p className="text-sm font-semibold">
                  {e.votos} voto(s) — resolvido por {e.criterioLabel}
                </p>
                <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  {e.candidatos.map((c) => (
                    <li key={c.matricula}>
                      {c.posicao}º {c.nome} ({c.matricula}) — admissão: {c.data_admissao ?? "não informada"}
                    </li>
                  ))}
                </ul>
                {e.semAdmissao.length > 0 && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Sem data de admissão para {e.semAdmissao.join(", ")} — cadastre em Empregados para que o desempate use o tempo de casa.
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

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
            Critério de desempate: maior nº de votos → maior tempo de casa (admissão mais antiga) → inscrição mais antiga → menor número de cédula (NR-5).
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

/* ============ ACOMPANHAR (LIVE) ============ */
function LiveMonitorTab({ electionId, status }: { electionId: string; status: ElectionStatus }) {
  const fn = useServerFn(getElectionLiveMonitor);
  const isVoting = status === "voting";
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [live, setLive] = useState(false);
  const q = useQuery({
    queryKey: ["live-monitor", electionId],
    queryFn: () => fn({ data: { electionId } }),
    refetchInterval: autoRefresh ? (live ? 60000 : isVoting ? 5000 : 15000) : false,
    refetchIntervalInBackground: false,
  });

  const refetchRef = useRef(q.refetch);
  refetchRef.current = q.refetch;

  useEffect(() => {
    if (!autoRefresh) {
      setLive(false);
      return;
    }
    let timer: ReturnType<typeof setTimeout> | null = null;
    const bump = () => {
      if (timer) return;
      // agrupa rajadas de votos em uma única atualização
      timer = setTimeout(() => {
        timer = null;
        void refetchRef.current();
      }, 400);
    };

    const channel = supabase
      .channel(`live-monitor-${electionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "votes", filter: `election_id=eq.${electionId}` },
        bump,
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "vote_tokens", filter: `election_id=eq.${electionId}` },
        bump,
      )
      .subscribe((s) => setLive(s === "SUBSCRIBED"));

    return () => {
      if (timer) clearTimeout(timer);
      setLive(false);
      supabase.removeChannel(channel);
    };
  }, [electionId, autoRefresh]);

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Carregando monitor...</p>;
  if (!q.data) return <p className="text-sm text-muted-foreground">Sem dados.</p>;
  const d = q.data;
  const turnout = d.stats.eleitoresAptos ? (d.stats.eleitoresQueVotaram / d.stats.eleitoresAptos) * 100 : 0;
  const maxVotos = d.ranking.reduce((m, c) => Math.max(m, c.votos), 0) || 1;
  const maxBucket = d.buckets.reduce((m, b) => Math.max(m, b.votos), 0) || 1;
  const updated = new Date(d.generatedAt);

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-sm">
          <span className={`grid h-8 w-8 place-items-center rounded-full ${isVoting ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
            <Activity className={`h-4 w-4 ${isVoting && autoRefresh ? "animate-pulse" : ""}`} />
          </span>
          <div>
            <div className="font-semibold">
              {isVoting ? "Votação em andamento" : "Votação não está aberta"}
            </div>
            <div className="text-xs text-muted-foreground">
              Atualizado às {updated.toLocaleTimeString("pt-BR")} ·{" "}
              {!autoRefresh ? "pausado" : live ? "tempo real (WebSocket)" : isVoting ? "atualiza a cada 5s" : "a cada 15s"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted"
          >
            {autoRefresh ? <><Pause className="h-3.5 w-3.5" /> Pausar</> : <><Play className="h-3.5 w-3.5" /> Retomar</>}
          </button>
          <button
            onClick={() => q.refetch()}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${q.isFetching ? "animate-spin" : ""}`} /> Atualizar
          </button>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Votos registrados" value={d.stats.eleitoresQueVotaram} />
        <Stat label="Aptos a votar" value={d.stats.eleitoresAptos} />
        <Stat label="Comparecimento" value={`${turnout.toFixed(1)}%`} />
        <Stat label="Faltam votar" value={Math.max(0, d.stats.eleitoresAptos - d.stats.eleitoresQueVotaram)} />
      </div>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Comparecimento</h2>
        <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(100, turnout)}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {d.stats.eleitoresQueVotaram} de {d.stats.eleitoresAptos} eleitores já votaram.
        </p>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Ritmo de votação (últimos 60 min)</h2>
        <div className="mt-3 flex h-32 items-end gap-1">
          {d.buckets.map((b, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1" title={`${b.votos} voto(s) até ${new Date(b.ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}>
              <div className="text-[10px] text-muted-foreground">{b.votos || ""}</div>
              <div
                className="w-full rounded-t bg-primary/70 transition-all"
                style={{ height: `${(b.votos / maxBucket) * 100}%`, minHeight: b.votos ? 4 : 1 }}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
          <span>-60 min</span>
          <span>agora</span>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Ranking parcial</h2>
          <span className="text-xs text-muted-foreground">
            {d.stats.nominais} nominais · {d.stats.brancos} brancos · {d.stats.nulos} nulos
          </span>
        </div>
        {d.ranking.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Sem candidatos aprovados.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {d.ranking.map((c: any, i: number) => {
              const pct = d.stats.nominais ? (c.votos / d.stats.nominais) * 100 : 0;
              const barPct = (c.votos / maxVotos) * 100;
              const eleito = c.classificacao === "titular";
              const suplente = c.classificacao === "suplente";
              return (
                <li key={c.id} className="rounded-md border border-border bg-background p-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-bold">
                        {c.posicao ?? i + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {c.numero ? `${c.numero} — ` : ""}{c.nome}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {c.setor ?? ""}{c.setor && c.matricula ? " · " : ""}mat. {c.matricula}
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {eleito && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">Titular</span>}
                      {suplente && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">Suplente</span>}
                      <div className="text-right">
                        <div className="font-semibold tabular-nums">{c.votos}</div>
                        <div className="text-[10px] text-muted-foreground">{pct.toFixed(1)}%</div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary transition-all" style={{ width: `${barPct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold">Últimos votos registrados</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          O voto é secreto — mostramos apenas o horário em que cada eleitor confirmou o voto.
        </p>
        {d.recentVotes.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nenhum voto ainda.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border text-sm">
            {d.recentVotes.map((v, i) => (
              <li key={i} className="flex items-center justify-between py-1.5">
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Voto confirmado
                </span>
                <span className="tabular-nums text-xs text-muted-foreground">
                  {new Date(v.voted_at).toLocaleString("pt-BR")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}