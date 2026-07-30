import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollText, Download, Search, X } from "lucide-react";

import { listAuditEvents, exportAuditCsv } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/auditoria")({
  head: () => ({
    meta: [
      { title: "Auditoria do processo eleitoral — CIPA" },
      {
        name: "description",
        content:
          "Registro completo de acessos e ações do processo eleitoral da CIPA, com filtros por período, ação e ator.",
      },
    ],
  }),
  component: AuditPage,
});

const ACOES = [
  { value: "", label: "Todas as ações" },
  { value: "voter.", label: "Eleitor (login/voto)" },
  { value: "election.", label: "Eleições" },
  { value: "candidate.", label: "Candidatos" },
  { value: "document.", label: "Documentos" },
  { value: "notice.", label: "Avisos" },
  { value: "challenge.", label: "Impugnações" },
  { value: "role.", label: "Permissões" },
  { value: "admin.", label: "Administração" },
];

function AuditPage() {
  const fn = useServerFn(listAuditEvents);
  const exportFn = useServerFn(exportAuditCsv);
  const [acao, setAcao] = useState("");
  const [ator, setAtor] = useState("");
  const [desde, setDesde] = useState("");
  const [ate, setAte] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const filters = { acao: acao || null, ator: ator || null, desde: desde || null, ate: ate || null };
  const q = useQuery({
    queryKey: ["audit-events", acao, ator, desde, ate, page],
    queryFn: () => fn({ data: { ...filters, page, pageSize } }),
  });

  const rows = q.data?.rows ?? [];
  const total = q.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasFilters = !!(acao || ator || desde || ate);

  async function baixarCsv() {
    const res = await exportFn({ data: filters });
    const blob = new Blob(["\uFEFF" + res.csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = res.filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <ScrollText className="h-5 w-5 text-primary" /> Auditoria
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} evento(s) registrado(s) com os filtros atuais.
          </p>
        </div>
        <button
          type="button"
          onClick={baixarCsv}
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          <Download className="h-4 w-4" /> Exportar CSV
        </button>
      </header>

      <div className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-xs font-medium text-muted-foreground">
          Tipo de ação
          <select
            value={acao}
            onChange={(e) => {
              setPage(0);
              setAcao(e.target.value);
            }}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          >
            {ACOES.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          Ator (matrícula ou usuário)
          <div className="relative mt-1">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              value={ator}
              onChange={(e) => {
                setPage(0);
                setAtor(e.target.value);
              }}
              placeholder="Buscar..."
              className="w-full rounded-md border border-input bg-background py-2 pl-8 pr-3 text-sm text-foreground"
            />
          </div>
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          De
          <input
            type="date"
            value={desde}
            onChange={(e) => {
              setPage(0);
              setDesde(e.target.value);
            }}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          Até
          <input
            type="date"
            value={ate}
            onChange={(e) => {
              setPage(0);
              setAte(e.target.value);
            }}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
        <div className="flex items-end">
          <button
            type="button"
            disabled={!hasFilters}
            onClick={() => {
              setAcao("");
              setAtor("");
              setDesde("");
              setAte("");
              setPage(0);
            }}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
          >
            <X className="h-4 w-4" /> Limpar
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Data</th>
              <th className="px-4 py-2">Ator</th>
              <th className="px-4 py-2">Ação</th>
              <th className="px-4 py-2">Detalhes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id} className="border-t border-border">
                <td className="whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">
                  {new Date(e.created_at).toLocaleString("pt-BR")}
                </td>
                <td className="px-4 py-2 text-xs">{e.ator ?? "—"}</td>
                <td className="px-4 py-2 font-mono text-xs">{e.acao}</td>
                <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                  {e.detalhes ? JSON.stringify(e.detalhes) : "—"}
                </td>
              </tr>
            ))}
            {q.isLoading && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-xs text-muted-foreground">
                  Carregando...
                </td>
              </tr>
            )}
            {!q.isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-xs text-muted-foreground">
                  Nenhum evento registrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Página {page + 1} de {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded-md border border-border px-3 py-1.5 hover:bg-muted disabled:opacity-50"
          >
            Anterior
          </button>
          <button
            type="button"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-md border border-border px-3 py-1.5 hover:bg-muted disabled:opacity-50"
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}