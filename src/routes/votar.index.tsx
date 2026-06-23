import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { LogIn, AlertCircle } from "lucide-react";

import { voterLogin } from "@/lib/voter.functions";
import { VoterShell } from "@/components/voter-shell";

export const Route = createFileRoute("/votar/")({
  head: () => ({
    meta: [
      { title: "Identificação do Eleitor — CIPA" },
      { name: "description", content: "Identifique-se com matrícula ou CPF para votar na eleição da CIPA." },
    ],
  }),
  component: VotarLogin,
});

function VotarLogin() {
  const navigate = useNavigate();
  const login = useServerFn(voterLogin);
  const [identificador, setIdentificador] = useState("");
  const [data, setData] = useState("");

  const mutation = useMutation({
    mutationFn: (input: { identificador: string; dataNascimento: string }) =>
      login({ data: input }),
    onSuccess: () => navigate({ to: "/votar/cedula" }),
  });

  return (
    <VoterShell>
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Identificação do eleitor
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Informe sua <strong>matrícula</strong> ou <strong>CPF</strong> e a sua
          data de nascimento para acessar a cédula.
        </p>

        <form
          className="mt-8 space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault();
            if (!identificador.trim() || !data) return;
            mutation.mutate({ identificador: identificador.trim(), dataNascimento: data });
          }}
        >
          <div>
            <label className="text-sm font-medium text-foreground" htmlFor="ident">
              Matrícula ou CPF
            </label>
            <input
              id="ident"
              autoFocus
              autoComplete="off"
              value={identificador}
              onChange={(e) => setIdentificador(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
              placeholder="Ex.: 1001 ou 111.111.111-11"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground" htmlFor="dob">
              Data de nascimento
            </label>
            <input
              id="dob"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
              required
            />
          </div>

          {mutation.isError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{(mutation.error as Error).message}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={mutation.isPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
          >
            <LogIn className="h-4 w-4" />
            {mutation.isPending ? "Validando..." : "Entrar"}
          </button>

          <p className="pt-2 text-center text-xs text-muted-foreground">
            Para teste: matrícula <code className="rounded bg-muted px-1">1001</code> · data{" "}
            <code className="rounded bg-muted px-1">1990-05-12</code>
          </p>
        </form>
      </div>
    </VoterShell>
  );
}