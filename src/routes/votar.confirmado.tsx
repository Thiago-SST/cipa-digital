import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2 } from "lucide-react";

import { voterLogout } from "@/lib/voter.functions";
import { VoterShell } from "@/components/voter-shell";

export const Route = createFileRoute("/votar/confirmado")({
  head: () => ({ meta: [{ title: "Voto registrado — CIPA" }] }),
  component: Confirmado,
});

function Confirmado() {
  const navigate = useNavigate();
  const logout = useServerFn(voterLogout);

  return (
    <VoterShell>
      <div className="mx-auto max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-sm">
        <CheckCircle2 className="mx-auto h-14 w-14 text-primary" />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
          Voto registrado com sucesso
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Obrigado por participar da eleição da CIPA. O seu voto é sigiloso e foi
          contabilizado.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={async () => {
              await logout();
              navigate({ to: "/" });
            }}
            className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Encerrar sessão
          </button>
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
            Voltar para a página inicial
          </Link>
        </div>
      </div>
    </VoterShell>
  );
}