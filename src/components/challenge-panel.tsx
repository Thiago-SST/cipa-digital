import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Gavel, X } from "lucide-react";

import { getChallengePanel, submitChallenge } from "@/lib/voter.functions";

type Candidate = {
  id: string;
  nome: string;
  setor: string | null;
  cargo: string | null;
  numero: number | null;
  status: string;
  foto_display_url: string | null;
};

export function ChallengePanel() {
  const panelFn = useServerFn(getChallengePanel);
  const panel = useQuery({ queryKey: ["challenge-panel"], queryFn: () => panelFn() });
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, true>>({});

  if (!panel.data || panel.data.open !== true) return null;
  const { election, candidates, authenticated } = panel.data;
  if (!candidates.length) return null;

  return (
    <section className="mt-6 rounded-lg border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Gavel className="h-4 w-4 text-primary" />
        Candidaturas inscritas
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Durante o período de{" "}
        {election.status === "registration" ? "inscrições" : "homologação"} qualquer eleitor
        pode impugnar uma candidatura, informando o motivo. O pedido será analisado pela
        comissão eleitoral.
      </p>
      {!authenticated && (
        <p className="mt-2 rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
          Identifique-se acima para poder impugnar uma candidatura.
        </p>
      )}

      <ul className="mt-3 space-y-2">
        {(candidates as Candidate[]).map((c) => (
          <li key={c.id} className="rounded-md border border-border p-3">
            <div className="flex items-center gap-3">
              {c.foto_display_url ? (
                <img
                  src={c.foto_display_url}
                  alt={`Foto de ${c.nome}`}
                  className="h-10 w-10 rounded-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-muted-foreground">
                  {c.nome.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">
                  {c.numero ? `${c.numero} · ` : ""}
                  {c.nome}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {[c.setor, c.cargo].filter(Boolean).join(" · ")}
                  {c.status === "pending" ? " · aguardando homologação" : ""}
                </div>
              </div>
              {done[c.id] ? (
                <span className="flex items-center gap-1 text-xs font-medium text-primary">
                  <CheckCircle2 className="h-4 w-4" /> Impugnação enviada
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setOpenFor(openFor === c.id ? null : c.id)}
                  className="shrink-0 rounded-md border border-destructive/40 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10"
                >
                  {openFor === c.id ? (
                    <span className="flex items-center gap-1">
                      <X className="h-3.5 w-3.5" /> Cancelar
                    </span>
                  ) : (
                    "Impugnar candidatura"
                  )}
                </button>
              )}
            </div>

            {openFor === c.id && !done[c.id] && (
              <ChallengeForm
                candidateId={c.id}
                onSuccess={() => {
                  setDone((d) => ({ ...d, [c.id]: true }));
                  setOpenFor(null);
                }}
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ChallengeForm({
  candidateId,
  onSuccess,
}: {
  candidateId: string;
  onSuccess: () => void;
}) {
  const send = useServerFn(submitChallenge);
  const [motivo, setMotivo] = useState("");
  const m = useMutation({
    mutationFn: () => send({ data: { candidateId, motivo: motivo.trim() } }),
    onSuccess,
  });
  const tooShort = motivo.trim().length < 10;

  return (
    <form
      className="mt-3 space-y-2 border-t border-border pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (tooShort) return;
        m.mutate();
      }}
    >
      <label className="text-xs font-medium text-foreground" htmlFor={`motivo-${candidateId}`}>
        Motivo da impugnação
      </label>
      <textarea
        id={`motivo-${candidateId}`}
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        rows={3}
        maxLength={1000}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
        placeholder="Descreva o motivo (mínimo 10 caracteres)."
        required
      />
      <div className="text-[11px] text-muted-foreground">{motivo.trim().length}/1000</div>

      {m.isError && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{(m.error as Error).message}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={tooShort || m.isPending}
        className="inline-flex items-center gap-2 rounded-md bg-destructive px-3 py-2 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
      >
        <Gavel className="h-3.5 w-3.5" />
        {m.isPending ? "Enviando..." : "Enviar impugnação"}
      </button>
    </form>
  );
}