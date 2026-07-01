import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";

import { listAuditEvents } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/auditoria")({
  component: AuditPage,
});

function AuditPage() {
  const fn = useServerFn(listAuditEvents);
  const q = useQuery({ queryKey: ["audit-events"], queryFn: () => fn() });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <ScrollText className="h-5 w-5 text-primary" /> Auditoria
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Últimos 200 eventos registrados pelo sistema.
        </p>
      </header>
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
            {(q.data ?? []).map((e) => (
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
            {q.data && q.data.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-xs text-muted-foreground">
                  Nenhum evento registrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}