import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, AlertCircle, LogOut, UserCircle2 } from "lucide-react";

import { getVoterBallot, castVote, voterLogout } from "@/lib/voter.functions";
import { VoterShell } from "@/components/voter-shell";

export const Route = createFileRoute("/votar/cedula")({
  head: () => ({ meta: [{ title: "Cédula — Eleição CIPA" }] }),
  component: Cedula,
});

function Cedula() {
  const navigate = useNavigate();
  const ballot = useServerFn(getVoterBallot);
  const vote = useServerFn(castVote);
  const logout = useServerFn(voterLogout);

  const [selected, setSelected] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const q = useQuery({
    queryKey: ["voter-ballot"],
    queryFn: () => ballot(),
    staleTime: 0,
  });

  const mutation = useMutation({
    mutationFn: (candidateId: string) => vote({ data: { candidateId } }),
    onSuccess: () => navigate({ to: "/votar/confirmado" }),
  });

  if (q.isLoading) {
    return (
      <VoterShell>
        <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          Carregando cédula...
        </div>
      </VoterShell>
    );
  }

  const data = q.data;
  if (!data || data.authenticated === false) {
    return (
      <VoterShell>
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="text-sm text-foreground">Sua sessão expirou.</p>
          <Link
            to="/votar"
            className="mt-4 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Voltar ao login
          </Link>
        </div>
      </VoterShell>
    );
  }

  if (data.hasVoted) {
    return (
      <VoterShell>
        <div className="rounded-lg border border-border bg-card p-6 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-3 text-lg font-semibold text-foreground">
            Você já registrou seu voto nesta eleição.
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cada empregado vota uma única vez.
          </p>
        </div>
      </VoterShell>
    );
  }

  const candidate = data.candidates.find((c) => c.id === selected) ?? null;

  return (
    <VoterShell>
      <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3 text-sm">
        <div className="flex items-center gap-2 text-foreground">
          <UserCircle2 className="h-4 w-4 text-primary" />
          <span>
            {data.voter.nome} · <span className="text-muted-foreground">matrícula {data.voter.matricula}</span>
          </span>
        </div>
        <button
          onClick={async () => {
            await logout();
            navigate({ to: "/votar" });
          }}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-3.5 w-3.5" /> Sair
        </button>
      </div>

      <div className="mt-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {data.election?.nome ?? "Eleição CIPA"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Selecione <strong>um candidato</strong> e confirme seu voto. O voto é sigiloso.
        </p>
      </div>

      <ul className="mt-6 grid gap-3">
        {data.candidates.map((c) => {
          const active = selected === c.id;
          return (
            <li key={c.id}>
              <button
                onClick={() => setSelected(c.id)}
                className={`flex w-full items-start gap-4 rounded-lg border bg-card p-4 text-left transition ${
                  active
                    ? "border-primary ring-2 ring-primary/30"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-md bg-secondary text-lg font-bold text-secondary-foreground">
                  {c.numero ?? "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-base font-semibold text-foreground">{c.nome}</span>
                    <span className="text-xs text-muted-foreground">matrícula {c.matricula}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {c.setor} {c.cargo ? `· ${c.cargo}` : ""}
                  </div>
                  {c.proposta && (
                    <p className="mt-2 line-clamp-3 text-sm text-foreground/80">{c.proposta}</p>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button
          disabled={!selected}
          onClick={() => setConfirming(true)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
        >
          Confirmar voto
        </button>
        {selected && (
          <button
            onClick={() => setSelected(null)}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Limpar seleção
          </button>
        )}
      </div>

      {mutation.isError && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{(mutation.error as Error).message}</span>
        </div>
      )}

      {confirming && candidate && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-foreground">Confirmar seu voto</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Esta ação não pode ser desfeita.
            </p>
            <div className="mt-4 rounded-md border border-border bg-secondary/40 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Candidato selecionado
              </div>
              <div className="mt-1 text-base font-semibold text-foreground">
                {candidate.numero ? `${candidate.numero} · ` : ""}{candidate.nome}
              </div>
              <div className="text-xs text-muted-foreground">
                {candidate.setor} {candidate.cargo ? `· ${candidate.cargo}` : ""}
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirming(false)}
                disabled={mutation.isPending}
                className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                Voltar
              </button>
              <button
                onClick={() => mutation.mutate(candidate.id)}
                disabled={mutation.isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {mutation.isPending ? "Registrando..." : "Confirmar voto"}
              </button>
            </div>
          </div>
        </div>
      )}
    </VoterShell>
  );
}