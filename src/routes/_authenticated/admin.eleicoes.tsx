import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Vote, Calendar, Pencil, Trash2 } from "lucide-react";

import { listElections, upsertElection, deleteElection } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/eleicoes")({
  head: () => ({
    meta: [
      { title: "Eleições da CIPA — Painel de gestão" },
      {
        name: "description",
        content: "Crie, edite e acompanhe os ciclos eleitorais da CIPA conforme a NR-5.",
      },
    ],
  }),
  component: ElectionsPage,
});

type ElectionFormValues = {
  id?: string;
  nome: string;
  descricao: string | null;
  data_inicio_inscricao: string | null;
  data_fim_inscricao: string | null;
  data_inicio_votacao: string | null;
  data_fim_votacao: string | null;
  vagas_titulares: number;
  vagas_suplentes: number;
};

type ElectionRow = {
  id: string;
  nome: string;
  descricao: string | null;
  status: string;
  vagas_titulares: number;
  vagas_suplentes: number;
  data_inicio_inscricao: string | null;
  data_fim_inscricao: string | null;
  data_inicio_votacao: string | null;
  data_fim_votacao: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  published: "Publicada",
  registration: "Inscrições",
  homologation: "Homologação",
  voting: "Em votação",
  counting: "Apuração",
  result_homologation: "Homolog. resultado",
  concluded: "Concluída",
  closed: "Encerrada",
};
const STATUS_TONE: Record<string, string> = {
  draft: "bg-muted text-foreground",
  published: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-200",
  registration: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
  homologation: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
  voting: "bg-primary/15 text-primary",
  counting: "bg-primary/15 text-primary",
  result_homologation: "bg-primary/15 text-primary",
  concluded: "bg-secondary text-secondary-foreground",
  closed: "bg-secondary text-secondary-foreground",
};

function ElectionsPage() {
  const list = useServerFn(listElections);
  const upsert = useServerFn(upsertElection);
  const remove = useServerFn(deleteElection);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<ElectionFormValues | null>(null);
  const [confirming, setConfirming] = useState<ElectionRow | null>(null);

  const q = useQuery({ queryKey: ["admin-elections"], queryFn: () => list() });

  const m = useMutation({
    mutationFn: (input: ElectionFormValues) => upsert({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-elections"] });
      setEditing(null);
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-elections"] });
      setConfirming(null);
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
          onClick={() =>
            setEditing({
              nome: "",
              descricao: "",
              data_inicio_inscricao: "",
              data_fim_inscricao: "",
              data_inicio_votacao: "",
              data_fim_votacao: "",
              vagas_titulares: 3,
              vagas_suplentes: 3,
            } as unknown as ElectionFormValues)
          }
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
              <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-5 transition hover:border-primary/40">
                <Link
                to="/admin/eleicoes/$id"
                params={{ id: e.id }}
                className="min-w-0 flex-1"
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
                <button
                  onClick={() => openEdit(e as ElectionRow, setEditing)}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted"
                  title="Editar"
                >
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </button>
                <button
                  onClick={() => {
                    del.reset();
                    setConfirming(e as ElectionRow);
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/10"
                  title="Excluir"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Excluir
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <ElectionDialog
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmit={(v) => m.mutate({ ...v, id: editing.id })}
          pending={m.isPending}
          error={m.error as Error | null}
        />
      )}

      {confirming && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4">
          <div className="w-full max-w-md space-y-4 rounded-lg border border-border bg-card p-6 shadow-xl">
            <h2 className="text-lg font-semibold">Excluir eleição</h2>
            <p className="text-sm text-muted-foreground">
              Isso remove definitivamente <strong className="text-foreground">{confirming.nome}</strong>, seus
              candidatos, avisos, comissão e documentos. Eleições que já receberam votos não podem ser excluídas —
              nesse caso, use o arquivamento.
            </p>
            {del.error && <p className="text-sm text-destructive">{(del.error as Error).message}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirming(null)}
                className="rounded-md border border-border px-4 py-2 text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={del.isPending}
                onClick={() => del.mutate(confirming.id)}
                className="rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60"
              >
                {del.isPending ? "Excluindo..." : "Excluir definitivamente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function openEdit(row: ElectionRow, set: (v: ElectionFormValues) => void) {
  set({
    id: row.id,
    nome: row.nome,
    descricao: row.descricao,
    data_inicio_inscricao: row.data_inicio_inscricao,
    data_fim_inscricao: row.data_fim_inscricao,
    data_inicio_votacao: row.data_inicio_votacao,
    data_fim_votacao: row.data_fim_votacao,
    vagas_titulares: row.vagas_titulares,
    vagas_suplentes: row.vagas_suplentes,
  });
}

function ElectionDialog({
  initial,
  onClose,
  onSubmit,
  pending,
  error,
}: {
  initial: ElectionFormValues;
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
  const toLocal = (v: string | null | undefined) => (v ? v.slice(0, 16) : "");
  const [form, setForm] = useState({
    nome: initial.nome ?? "",
    descricao: initial.descricao ?? "",
    data_inicio_inscricao: toLocal(initial.data_inicio_inscricao),
    data_fim_inscricao: toLocal(initial.data_fim_inscricao),
    data_inicio_votacao: toLocal(initial.data_inicio_votacao),
    data_fim_votacao: toLocal(initial.data_fim_votacao),
    vagas_titulares: initial.vagas_titulares ?? 3,
    vagas_suplentes: initial.vagas_suplentes ?? 3,
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
        <h2 className="text-lg font-semibold">{initial.id ? "Editar eleição" : "Nova eleição"}</h2>
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