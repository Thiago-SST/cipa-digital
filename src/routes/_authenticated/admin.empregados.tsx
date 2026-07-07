import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Plus, Upload, Trash2, Users, Pencil } from "lucide-react";

import { listEmployees, upsertEmployee, deleteEmployee, importEmployees } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/empregados")({
  component: EmployeesPage,
});

type EmpInput = {
  id?: string;
  matricula: string;
  nome: string;
  cpf: string | null;
  email: string | null;
  setor: string | null;
  cargo: string | null;
  data_nascimento: string;
  ativo?: boolean;
};

function EmployeesPage() {
  const fnList = useServerFn(listEmployees);
  const fnUp = useServerFn(upsertEmployee);
  const fnDel = useServerFn(deleteEmployee);
  const fnImport = useServerFn(importEmployees);
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<EmpInput | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const q = useQuery({ queryKey: ["admin-employees"], queryFn: () => fnList() });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-employees"] });

  const mUp = useMutation({ mutationFn: (v: EmpInput) => fnUp({ data: v }), onSuccess: () => { invalidate(); setEditing(null); } });
  const mDel = useMutation({ mutationFn: (id: string) => fnDel({ data: { id } }), onSuccess: invalidate });
  const mImport = useMutation({
    mutationFn: (rows: EmpInput[]) => fnImport({ data: { rows } }),
    onSuccess: (r) => { invalidate(); setImportMsg(`${r.imported} empregados importados.`); },
    onError: (e) => setImportMsg((e as Error).message),
  });

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const rows = parseCsv(text);
    if (!rows.length) { setImportMsg("CSV vazio ou inválido."); return; }
    mImport.mutate(rows);
    e.target.value = "";
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Empregados</h1>
          <p className="mt-1 text-sm text-muted-foreground">Base de eleitores aptos a votar.</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
          <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted">
            <Upload className="h-3.5 w-3.5" /> Importar CSV
          </button>
          <button onClick={() => setEditing({ matricula: "", nome: "", cpf: "", email: "", setor: "", cargo: "", data_nascimento: "", ativo: true })} className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
            <Plus className="h-3.5 w-3.5" /> Novo
          </button>
        </div>
      </header>

      <p className="text-xs text-muted-foreground">
        Formato CSV esperado (com cabeçalho): <code>matricula,nome,cpf,email,setor,cargo,data_nascimento</code>. Data no formato AAAA-MM-DD.
      </p>
      {importMsg && <p className="text-xs text-primary">{importMsg}</p>}

      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : !q.data?.length ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
          <Users className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhum empregado cadastrado.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="p-3">Matrícula</th><th>Nome</th><th>Setor</th><th>Nasc.</th><th>Ativo</th><th /></tr>
            </thead>
            <tbody>
              {q.data.map((e) => (
                <tr key={e.id} className="border-b border-border/50">
                  <td className="p-3 font-mono">{e.matricula}</td>
                  <td>{e.nome}</td>
                  <td>{e.setor ?? "—"}</td>
                  <td>{e.data_nascimento}</td>
                  <td>{e.ativo ? "Sim" : "Não"}</td>
                  <td className="pr-3 text-right space-x-2">
                    <button
                      onClick={() => setEditing({
                        id: e.id,
                        matricula: e.matricula,
                        nome: e.nome,
                        cpf: e.cpf ?? "",
                        email: e.email ?? "",
                        setor: e.setor ?? "",
                        cargo: e.cargo ?? "",
                        data_nascimento: e.data_nascimento,
                        ativo: e.ativo,
                      })}
                      className="text-muted-foreground hover:text-foreground"
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4 inline" />
                    </button>
                    <button onClick={() => confirm(`Excluir ${e.nome}?`) && mDel.mutate(e.id)} className="text-destructive">
                      <Trash2 className="h-4 w-4 inline" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <EmpDialog
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmit={(v) => mUp.mutate(v)}
          pending={mUp.isPending}
          error={mUp.error as Error | null}
        />
      )}
    </div>
  );
}

function EmpDialog({
  initial, onClose, onSubmit, pending, error,
}: { initial: EmpInput; onClose: () => void; onSubmit: (v: EmpInput) => void; pending: boolean; error: Error | null }) {
  const [f, setF] = useState({
    matricula: initial.matricula ?? "",
    nome: initial.nome ?? "",
    cpf: initial.cpf ?? "",
    email: initial.email ?? "",
    setor: initial.setor ?? "",
    cargo: initial.cargo ?? "",
    data_nascimento: initial.data_nascimento ?? "",
    ativo: initial.ativo ?? true,
  });
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            id: initial.id,
            matricula: f.matricula,
            nome: f.nome,
            cpf: f.cpf || null,
            email: f.email || null,
            setor: f.setor || null,
            cargo: f.cargo || null,
            data_nascimento: f.data_nascimento,
            ativo: f.ativo,
          });
        }}
        className="w-full max-w-md space-y-3 rounded-lg border border-border bg-card p-5 shadow-xl"
      >
        <h3 className="text-lg font-semibold">{initial.id ? "Editar empregado" : "Novo empregado"}</h3>
        <div className="grid grid-cols-2 gap-2">
          <input required placeholder="Matrícula" value={f.matricula} onChange={(e) => setF({ ...f, matricula: e.target.value })} className={inputCls} />
          <input required type="date" value={f.data_nascimento} onChange={(e) => setF({ ...f, data_nascimento: e.target.value })} className={inputCls} />
        </div>
        <input required placeholder="Nome completo" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} className={inputCls} />
        <div className="grid grid-cols-2 gap-2">
          <input placeholder="CPF" value={f.cpf} onChange={(e) => setF({ ...f, cpf: e.target.value })} className={inputCls} />
          <input type="email" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={inputCls} />
          <input placeholder="Setor" value={f.setor} onChange={(e) => setF({ ...f, setor: e.target.value })} className={inputCls} />
          <input placeholder="Cargo" value={f.cargo} onChange={(e) => setF({ ...f, cargo: e.target.value })} className={inputCls} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.ativo} onChange={(e) => setF({ ...f, ativo: e.target.checked })} />
          Ativo (elegível para votar e ser votado)
        </label>
        {error && <p className="text-sm text-destructive">{error.message}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-sm">Cancelar</button>
          <button type="submit" disabled={pending} className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            {pending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2";

function parseCsv(text: string): EmpInput[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const header = lines[0].split(/[;,]/).map((h) => h.trim().toLowerCase());
  const idx = (k: string) => header.indexOf(k);
  const out: EmpInput[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(/[;,]/).map((c) => c.trim());
    const matricula = cols[idx("matricula")];
    const nome = cols[idx("nome")];
    const dn = cols[idx("data_nascimento")];
    if (!matricula || !nome || !dn) continue;
    out.push({
      matricula,
      nome,
      cpf: cols[idx("cpf")] || null,
      email: cols[idx("email")] || null,
      setor: cols[idx("setor")] || null,
      cargo: cols[idx("cargo")] || null,
      data_nascimento: dn,
      ativo: true,
    });
  }
  return out;
}