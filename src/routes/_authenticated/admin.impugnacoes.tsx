import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronDown, ChevronRight, Gavel, Search, X } from "lucide-react";

import { listAllChallenges, judgeChallenge } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/impugnacoes")({
  head: () => ({
    meta: [
      { title: "Impugnações de candidaturas — CIPA" },
      {
        name: "description",
        content:
          "Liste, filtre e julgue as impugnações de candidaturas recebidas durante a inscrição e a homologação da eleição da CIPA.",
      },
      { property: "og:title", content: "Impugnações de candidaturas — CIPA" },
      {
        property: "og:description",
        content: "Painel administrativo de impugnações do processo eleitoral da CIPA.",
      },
    ],
  }),
  component: ChallengesPage,
});

const DECISOES = [
  { value: "", label: "Todas as decisões" },
  { value: "pendente", label: "Pendentes" },
  { value: "deferido", label: "Deferidas" },
  { value: "indeferido", label: "Indeferidas" },
] as const;

function badgeClass(decisao: string) {
  if (decisao === "pendente") return "bg-amber-100 text-amber-800";
  if (decisao === "deferido") return "bg-destructive/15 text-destructive";
  return "bg-primary/15 text-primary";
}

function ChallengesPage() {
  const listFn = useServerFn(listAllChallenges);
  const judgeFn = useServerFn(judgeChallenge);
  const qc = useQueryClient();

  const [electionId, setElectionId] = useState("");
  const [decisao, setDecisao] = useState("");
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [somentePeriodoAtivo, setSomentePeriodoAtivo] = useState(true);
  const [aberto, setAberto] = useState<Record<string, boolean>>({});

  const q = useQuery({
    queryKey: ["all-challenges", electionId, decisao, buscaAplicada, somentePeriodoAtivo],
    queryFn: () =>
      listFn({
        data: {
          electionId: electionId || null,
          decisao: (decisao || null) as "pendente" | "deferido" | "indeferido" | null,
          busca: buscaAplicada || null,
          somentePeriodoAtivo,
        },
      }),
  });

  const rows = q.data?.rows ?? [];
  const elections = q.data?.elections ?? [];
  const electionName = (id: string) => elections.find((e) => e.id === id)?.nome ?? "—";
  const pendentes = rows.filter((r: any) => r.decisao === "pendente").length;
  const hasFilters = !!(electionId || decisao || buscaAplicada) || somentePeriodoAtivo;

  async function julgar(id: string, d: "deferido" | "indeferido") {
    const j = prompt(`Justificativa do ${d === "deferido" ? "deferimento" : "indeferimento"} (opcional):`) ?? "";
    await judgeFn({ data: { id, decisao: d, justificativa: j || null } });
    qc.invalidateQueries({ queryKey: ["all-challenges"] });
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Gavel className="h-5 w-5 text-primary" /> Impugnações de candidaturas
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pedidos enviados pelos eleitores durante os períodos de inscrição e homologação.
          {pendentes > 0 && (
            <span className="ml-1 font-medium text-amber-700">{pendentes} pendente(s) de julgamento.</span>
          )}
        </p>
      </header>

      <section className="rounded-lg border border-border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Eleição</label>
            <select
              value={electionId}
              onChange={(e) => setElectionId(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Todas as eleições</option>
              {elections.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <select
              value={decisao}
              onChange={(e) => setDecisao(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {DECISOES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">
              Buscar por autor, matrícula ou motivo
            </label>
            <form
              className="mt-1 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                setBuscaAplicada(busca.trim());
              }}
            >
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Ex.: 1001 ou conflito de interesse"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 text-sm hover:bg-muted"
              >
                <Search className="h-4 w-4" /> Buscar
              </button>
            </form>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={somentePeriodoAtivo}
              onChange={(e) => setSomentePeriodoAtivo(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            Mostrar apenas eleições em inscrição/homologação
          </label>
          {hasFilters && (
            <button
              onClick={() => {
                setElectionId("");
                setDecisao("");
                setBusca("");
                setBuscaAplicada("");
                setSomentePeriodoAtivo(false);
              }}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" /> Limpar filtros
            </button>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        {q.isLoading ? (
          <p className="text-xs text-muted-foreground">Carregando...</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhuma impugnação encontrada com os filtros atuais.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((c: any) => (
              <li key={c.id} className="space-y-2 py-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <button
                      type="button"
                      onClick={() => setAberto((a) => ({ ...a, [c.id]: !a[c.id] }))}
                      className="flex items-center gap-1 text-left font-medium hover:underline"
                    >
                      {aberto[c.id] ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      Candidato: {c.candidates?.nome ?? "—"} (mat. {c.candidates?.matricula ?? "—"})
                    </button>
                    <div className="text-xs text-muted-foreground">
                      {electionName(c.election_id)} · Autor: {c.autor_nome} (mat. {c.autor_matricula}) ·{" "}
                      {new Date(c.created_at).toLocaleString("pt-BR")}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${badgeClass(c.decisao)}`}
                  >
                    {c.decisao}
                  </span>
                </div>
                <p className="rounded-md bg-muted/40 p-2 text-xs">{c.motivo}</p>
                {aberto[c.id] && c.candidates && (
                  <div className="flex gap-3 rounded-md border border-border bg-background p-3">
                    {c.candidates.foto_display_url ? (
                      <img
                        src={c.candidates.foto_display_url}
                        alt={`Foto de ${c.candidates.nome}`}
                        className="h-20 w-20 shrink-0 rounded-md object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-md bg-secondary text-xs font-semibold text-muted-foreground">
                        sem foto
                      </div>
                    )}
                    <div className="min-w-0 flex-1 space-y-1 text-xs">
                      <div>
                        <strong>Número:</strong> {c.candidates.numero ?? "—"} ·{" "}
                        <strong>Status:</strong>{" "}
                        {c.candidates.status === "approved"
                          ? "homologada"
                          : c.candidates.status === "rejected"
                            ? "indeferida"
                            : "aguardando homologação"}
                      </div>
                      <div>
                        <strong>Setor:</strong> {c.candidates.setor || "—"} ·{" "}
                        <strong>Cargo:</strong> {c.candidates.cargo || "—"}
                      </div>
                      <div className="whitespace-pre-wrap text-muted-foreground">
                        <strong className="text-foreground">Proposta:</strong>{" "}
                        {c.candidates.proposta || "Não informada."}
                      </div>
                    </div>
                  </div>
                )}
                {c.justificativa && (
                  <p className="text-xs text-muted-foreground">
                    <strong>Justificativa:</strong> {c.justificativa}
                    {c.decidido_em && ` · ${new Date(c.decidido_em).toLocaleString("pt-BR")}`}
                  </p>
                )}
                {c.decisao === "pendente" && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => julgar(c.id, "deferido")}
                      className="rounded-md border border-destructive/30 bg-background px-3 py-1 text-xs text-destructive hover:bg-destructive/10"
                    >
                      Deferir (invalidar candidatura)
                    </button>
                    <button
                      onClick={() => julgar(c.id, "indeferido")}
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