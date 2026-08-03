import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { AlertCircle, CheckCircle2, ClipboardEdit, LogIn } from "lucide-react";

import { VoterShell } from "@/components/voter-shell";
import {
  getMyCandidacy,
  registerCandidacy,
  voterLogin,
  voterLogout,
  uploadMyCandidacyPhoto,
} from "@/lib/voter.functions";

export const Route = createFileRoute("/candidatar")({
  head: () => ({ meta: [{ title: "Candidatar-se — Eleição CIPA" }] }),
  component: CandidatarPage,
});

function CandidatarPage() {
  const q = useQuery({
    queryKey: ["my-candidacy"],
    queryFn: () => getMyCandidacyFn(),
  });
  const getMyCandidacyFn = useServerFn(getMyCandidacy);
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  getMyCandidacyFn;

  if (q.isLoading) {
    return (
      <VoterShell>
        <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          Carregando...
        </div>
      </VoterShell>
    );
  }

  if (!q.data || q.data.authenticated === false) {
    return <LoginForm onSuccess={() => q.refetch()} />;
  }

  return <CandidacyForm data={q.data} onDone={() => q.refetch()} />;
}

function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const login = useServerFn(voterLogin);
  const [identificador, setIdentificador] = useState("");
  const [data, setData] = useState("");
  const m = useMutation({
    mutationFn: (input: { identificador: string; dataNascimento: string }) =>
      login({ data: input }),
    onSuccess: () => onSuccess(),
  });

  return (
    <VoterShell>
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Inscrição de candidato
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Identifique-se para inscrever sua candidatura.
        </p>
        <form
          className="mt-8 space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault();
            if (!identificador.trim() || !data) return;
            m.mutate({ identificador: identificador.trim(), dataNascimento: data });
          }}
        >
          <div>
            <label className="text-sm font-medium">Matrícula ou CPF</label>
            <input
              value={identificador}
              onChange={(e) => setIdentificador(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium">Data de nascimento</label>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
              required
            />
          </div>
          {m.isError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{(m.error as Error).message}</span>
            </div>
          )}
          <button
            type="submit"
            disabled={m.isPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            <LogIn className="h-4 w-4" />
            {m.isPending ? "Validando..." : "Entrar"}
          </button>
          <Link
            to="/votar"
            className="block text-center text-xs text-muted-foreground hover:text-foreground"
          >
            Voltar
          </Link>
        </form>
      </div>
    </VoterShell>
  );
}

type CandidacyState = NonNullable<Awaited<ReturnType<typeof getMyCandidacy>>>;

function CandidacyPhotoUploader({
  nome,
  url,
  onDone,
}: {
  nome: string;
  url: string | null;
  onDone: () => void;
}) {
  const upload = useServerFn(uploadMyCandidacyPhoto);
  const inputRef = useRef<HTMLInputElement>(null);
  const m = useMutation({
    mutationFn: async (file: File) => {
      const { fileToBase64 } = await import("@/lib/file-to-base64");
      return upload({
        data: { fileName: file.name, mimeType: file.type, fileBase64: await fileToBase64(file) },
      });
    },
    onSuccess: () => onDone(),
  });

  return (
    <div className="mt-4 rounded-md border border-border p-3">
      <div className="text-xs text-muted-foreground">Foto da cédula</div>
      <div className="mt-2 flex items-center gap-3">
        {url ? (
          <img src={url} alt={`Foto de ${nome}`} className="h-14 w-14 rounded-full object-cover" />
        ) : (
          <span className="grid h-14 w-14 place-items-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
            {nome.slice(0, 2).toUpperCase()}
          </span>
        )}
        <button
          type="button"
          disabled={m.isPending}
          onClick={() => inputRef.current?.click()}
          className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-60"
        >
          {m.isPending ? "Enviando..." : url ? "Trocar foto" : "Enviar foto"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) m.mutate(file);
          }}
        />
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">JPG, PNG ou WEBP, até 3 MB.</p>
      {m.isError && <p className="mt-2 text-xs text-destructive">{(m.error as Error).message}</p>}
    </div>
  );
}

function CandidacyForm({ data, onDone }: { data: CandidacyState; onDone: () => void }) {
  const navigate = useNavigate();
  const logout = useServerFn(voterLogout);
  const register = useServerFn(registerCandidacy);
  const [cargo, setCargo] = useState("");
  const [setor, setSetor] = useState("");
  const [proposta, setProposta] = useState("");

  const m = useMutation({
    mutationFn: () => register({ data: { cargo, setor, proposta } }),
    onSuccess: () => onDone(),
  });

  if (data.authenticated === false) return null;

  if (!data.election) {
    return (
      <VoterShell>
        <div className="mx-auto max-w-md rounded-lg border border-border bg-card p-6 text-center">
          <p className="text-sm text-foreground">
            Não há eleição com inscrições abertas no momento.
          </p>
          <Link
            to="/votar"
            className="mt-4 inline-flex text-xs text-muted-foreground hover:text-foreground"
          >
            Voltar
          </Link>
        </div>
      </VoterShell>
    );
  }

  if (data.candidacy) {
    return (
      <VoterShell>
        <div className="mx-auto max-w-md rounded-lg border border-border bg-card p-6">
          <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
          <h1 className="mt-3 text-center text-lg font-semibold text-foreground">
            Candidatura registrada
          </h1>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            Status:{" "}
            <span className="font-semibold text-foreground">
              {data.candidacy.status === "pending"
                ? "aguardando aprovação"
                : data.candidacy.status === "approved"
                  ? "aprovada"
                  : "rejeitada"}
            </span>
          </p>
          <div className="mt-4 rounded-md border border-border bg-secondary/40 p-3 text-sm">
            <div className="text-xs text-muted-foreground">Sua proposta</div>
            <p className="mt-1 text-foreground">{data.candidacy.proposta}</p>
          </div>
          <CandidacyPhotoUploader
            nome={data.voter.nome}
            url={data.candidacy.foto_display_url}
            onDone={onDone}
          />
          <button
            onClick={async () => {
              await logout();
              navigate({ to: "/" });
            }}
            className="mt-5 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Encerrar sessão
          </button>
        </div>
      </VoterShell>
    );
  }

  if (!data.inWindow) {
    return (
      <VoterShell>
        <div className="mx-auto max-w-md rounded-lg border border-border bg-card p-6 text-center">
          <p className="text-sm text-foreground">
            As inscrições da eleição <strong>{data.election.nome}</strong> estão fora do
            horário permitido.
          </p>
        </div>
      </VoterShell>
    );
  }

  return (
    <VoterShell>
      <div className="mx-auto max-w-xl">
        <div className="mb-6 rounded-lg border border-border bg-card p-4 text-sm">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Eleição</div>
          <div className="text-foreground font-semibold">{data.election.nome}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Eleitor: {data.voter.nome} · matrícula {data.voter.matricula}
          </div>
        </div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground">
          <ClipboardEdit className="h-5 w-5 text-primary" /> Inscrever candidatura
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sua inscrição será enviada para aprovação da comissão organizadora.
        </p>
        <form
          className="mt-6 space-y-4 rounded-lg border border-border bg-card p-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (proposta.trim().length < 10) return;
            m.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Cargo (opcional)</label>
              <input
                value={cargo}
                onChange={(e) => setCargo(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Ex.: Analista"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Setor (opcional)</label>
              <input
                value={setor}
                onChange={(e) => setSetor(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Ex.: Operações"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Proposta *</label>
            <textarea
              value={proposta}
              onChange={(e) => setProposta(e.target.value)}
              rows={5}
              maxLength={1000}
              minLength={10}
              required
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Por que quer participar da CIPA? O que pretende propor?"
            />
            <p className="mt-1 text-xs text-muted-foreground">{proposta.length}/1000</p>
          </div>
          {m.isError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{(m.error as Error).message}</span>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={async () => {
                await logout();
                navigate({ to: "/" });
              }}
              className="rounded-md border border-border bg-background px-4 py-2 text-sm hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={m.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {m.isPending ? "Enviando..." : "Enviar candidatura"}
            </button>
          </div>
        </form>
      </div>
    </VoterShell>
  );
}