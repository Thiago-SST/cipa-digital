import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Users, Vote, Activity, ArrowRight } from "lucide-react";

import { getAdminDashboard } from "@/lib/admin.functions";
import { QueryError } from "@/components/query-error";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: Dashboard,
});

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  registration: "Inscrições abertas",
  voting: "Em votação",
  closed: "Encerrada",
};

function Dashboard() {
  const fn = useServerFn(getAdminDashboard);
  const q = useQuery({ queryKey: ["admin-dashboard"], queryFn: () => fn() });

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (q.isError || !q.data)
    return (
      <QueryError
        error={q.error}
        pending={q.isFetching}
        onRetry={() => q.refetch()}
        title="Não foi possível carregar a visão geral."
      />
    );
  const d = q.data!;
  const turnout = d.progress?.eligible
    ? Math.round((d.progress.votes / d.progress.eligible) * 100)
    : 0;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Visão geral</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acompanhamento do processo eleitoral da CIPA.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon={Users} label="Empregados ativos" value={d.totals.employees} />
        <StatCard icon={Vote} label="Eleições cadastradas" value={d.totals.elections} />
        <StatCard
          icon={Activity}
          label="Comparecimento (atual)"
          value={d.progress ? `${turnout}%` : "—"}
          hint={d.progress ? `${d.progress.votes} de ${d.progress.eligible}` : undefined}
        />
      </div>

      <section className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Eleição mais recente
            </div>
            <h2 className="mt-1 text-lg font-semibold">
              {d.currentElection?.nome ?? "Nenhuma eleição cadastrada"}
            </h2>
            {d.currentElection && (
              <div className="mt-1 text-xs text-muted-foreground">
                Status: {STATUS_LABEL[d.currentElection.status] ?? d.currentElection.status} ·{" "}
                {d.currentElection.vagas_titulares} titulares · {d.currentElection.vagas_suplentes} suplentes
              </div>
            )}
          </div>
          <Link
            to="/admin/eleicoes"
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted"
          >
            Gerenciar <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-2 text-3xl font-semibold text-foreground">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}