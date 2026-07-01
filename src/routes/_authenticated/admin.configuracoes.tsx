import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Save, Building2 } from "lucide-react";

import { getOrgSettings, updateOrgSettings } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/configuracoes")({
  component: ConfigPage,
});

function ConfigPage() {
  const qc = useQueryClient();
  const getFn = useServerFn(getOrgSettings);
  const upFn = useServerFn(updateOrgSettings);
  const q = useQuery({ queryKey: ["org-settings"], queryFn: () => getFn() });

  const [form, setForm] = useState({
    nome: "",
    cnpj: "",
    endereco: "",
    mandato_inicio: "",
    mandato_fim: "",
    texto_edital: "",
  });

  useEffect(() => {
    if (q.data) {
      setForm({
        nome: q.data.nome ?? "",
        cnpj: q.data.cnpj ?? "",
        endereco: q.data.endereco ?? "",
        mandato_inicio: q.data.mandato_inicio ?? "",
        mandato_fim: q.data.mandato_fim ?? "",
        texto_edital: q.data.texto_edital ?? "",
      });
    }
  }, [q.data]);

  const m = useMutation({
    mutationFn: () =>
      upFn({
        data: {
          nome: form.nome,
          cnpj: form.cnpj || null,
          endereco: form.endereco || null,
          mandato_inicio: form.mandato_inicio || null,
          mandato_fim: form.mandato_fim || null,
          texto_edital: form.texto_edital || null,
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-settings"] }),
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Building2 className="h-5 w-5 text-primary" /> Configurações da organização
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Dados usados nos cabeçalhos das atas e no edital.
        </p>
      </header>

      <form
        className="space-y-4 rounded-lg border border-border bg-card p-6"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome da organização *">
            <input
              required
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="CNPJ">
            <input
              value={form.cnpj}
              onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
              className={inputCls}
              placeholder="00.000.000/0000-00"
            />
          </Field>
          <Field label="Endereço" full>
            <input
              value={form.endereco}
              onChange={(e) => setForm({ ...form, endereco: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="Início do mandato">
            <input
              type="date"
              value={form.mandato_inicio}
              onChange={(e) => setForm({ ...form, mandato_inicio: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="Fim do mandato">
            <input
              type="date"
              value={form.mandato_fim}
              onChange={(e) => setForm({ ...form, mandato_fim: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="Texto padrão do edital" full>
            <textarea
              value={form.texto_edital}
              onChange={(e) => setForm({ ...form, texto_edital: e.target.value })}
              rows={6}
              className={inputCls}
              placeholder="Texto que será usado como base para o edital de convocação da eleição."
            />
          </Field>
        </div>
        <div className="flex justify-end">
          <button
            disabled={m.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {m.isPending ? "Salvando..." : "Salvar"}
          </button>
        </div>
        {m.isSuccess && (
          <p className="text-xs text-primary">Configurações salvas.</p>
        )}
      </form>
    </div>
  );
}

const inputCls =
  "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2";

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : undefined}>
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}