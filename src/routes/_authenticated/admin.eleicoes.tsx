import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Vote, Calendar } from "lucide-react";

import { listElections, upsertElection } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/eleicoes")({
  component: ElectionsPage,
});

type ElectionFormValues = {
  nome: string;
  descricao: string | null;
  data_inicio_inscricao: string | null;
  data_fim_inscricao: string | null;
  data_inicio_votacao: string | null;
  data_fim_votacao: string | null;
  vagas_titulares: number;
  vagas_suplentes: number;
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  registration: "Inscrições",
  voting: "Em votação",
  closed: "Encerrada",
};
const STATUS_TONE: Record<string, string> = {
  draft: "bg-muted text-foreground",
  registration: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
  voting: "bg-primary/15 text-primary",
  closed: "bg-secondary text-secondary-foreground",
};

function ElectionsPage() {
  const list = useServerFn(listElections);
  const upsert = useServerFn(upsertElection);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const q = useQuery({ queryKey: ["admin-elections"], queryFn: () => list() });

  const m = useMutation({
    mutationFn: (input: ElectionFormValues) => upsert({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-elections"] });
      setOpen(false);
    },
  });

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Eleições</h1>
          <p className="mt-1 text-sm text-muted-foreground">Crie e gerencie ciclos eleitorais da CIPA.</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Nova eleição
        </button>
      </header>

      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : !q.data?.length ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
          <Vote className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhuma eleição cadastrada.</p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {q.data.map((e) => (
            <li key={e.id}>
              <Link
                to="/admin/eleicoes/$id"
                params={{ id: e.id }}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-5 transition hover:border-primary/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-semibold">{e.nome}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${STATUS_TONE[e.status]}`}>
                      {STATUS_LABEL[e.status] ?? e.status}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>{e.vagas_titulares} titulares · {e.vagas_suplentes} suplentes</span>
                    {e.data_fim_votacao && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> até {new Date(e.data_fim_votacao).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {open && <ElectionDialog onClose={() => setOpen(false)} onSubmit={(v) => m.mutate(v)} pending={m.isPending} error={m.error as Error | null} />}
    </div>
  );
}

function ElectionDialog({
  onClose,
  onSubmit,
  pending,
  error,
}: {
  onClose: () => void;
  onSubmit: (v: {
    nome: string;
    descricao: string | null;
    data_inicio_inscricao: string | null;
    data_fim_inscricao: string | null;
    data_inicio_votacao: string | null;
    data_fim_votacao: string | null;
    vagas_titulares: number;
    vagas_suplentes: number;
  }) => void;
  pending: boolean;
  error: Error | null;
}) {
  const [form, setForm] = useState({
    nome: "",
    descricao: "",
    data_inicio_inscricao: "",
    data_fim_inscricao: "",
    data_inicio_votacao: "",
    data_fim_votacao: "",
    vagas_titulares: 3,
    vagas_suplentes: 3,
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            nome: form.nome,
            descricao: form.descricao || null,
            data_inicio_inscricao: form.data_inicio_inscricao || null,
            data_fim_inscricao: form.data_fim_inscricao || null,
            data_inicio_votacao: form.data_inicio_votacao || null,
            data_fim_votacao: form.data_fim_votacao || null,
            vagas_titulares: Number(form.vagas_titulares),
            vagas_suplentes: Number(form.vagas_suplentes),
          });
        }}
        className="w-full max-w-lg space-y-4 rounded-lg border border-border bg-card p-6 shadow-xl"
      >
        <h2 className="text-lg font-semibold">Nova eleição</h2>
        <Field label="Nome">
          <input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className={inputCls} />
        </Field>
        <Field label="Descrição">
          <textarea rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className={inputCls} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Início inscrições">
            <input type="datetime-local" value={form.data_inicio_inscricao} onChange={(e) => setForm({ ...form, data_inicio_inscricao: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Fim inscrições">
            <input type="datetime-local" value={form.data_fim_inscricao} onChange={(e) => setForm({ ...form, data_fim_inscricao: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Início votação">
            <input type="datetime-local" value={form.data_inicio_votacao} onChange={(e) => setForm({ ...form, data_inicio_votacao: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Fim votação">
            <input type="datetime-local" value={form.data_fim_votacao} onChange={(e) => setForm({ ...form, data_fim_votacao: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Vagas titulares">
            <input type="number" min={1} value={form.vagas_titulares} onChange={(e) => setForm({ ...form, vagas_titulares: Number(e.target.value) })} className={inputCls} />
          </Field>
          <Field label="Vagas suplentes">
            <input type="number" min={0} value={form.vagas_suplentes} onChange={(e) => setForm({ ...form, vagas_suplentes: Number(e.target.value) })} className={inputCls} />
          </Field>
        </div>
        {error && <p className="text-sm text-destructive">{error.message}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm">Cancelar</button>
          <button type="submit" disabled={pending} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            {pending ? "Salvando..." : "Criar eleição"}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputCls = "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-foreground">
      {label}
      {children}
    </label>
  );
}