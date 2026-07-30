import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { UserCog, KeyRound, ShieldCheck, CheckCircle2, AlertCircle } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { getAdminContext, listAdminUsers, setUserRole } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/perfil")({
  head: () => ({
    meta: [
      { title: "Perfil e acessos — Painel CIPA" },
      {
        name: "description",
        content: "Altere sua senha e gerencie quem tem acesso de administrador ou organizador do processo eleitoral.",
      },
    ],
  }),
  component: ProfilePage,
});

const inputCls =
  "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2";

function ProfilePage() {
  const ctxFn = useServerFn(getAdminContext);
  const usersFn = useServerFn(listAdminUsers);
  const roleFn = useServerFn(setUserRole);
  const qc = useQueryClient();

  const ctx = useQuery({ queryKey: ["admin-context"], queryFn: () => ctxFn() });
  const users = useQuery({ queryKey: ["admin-users"], queryFn: () => usersFn() });

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwDone, setPwDone] = useState(false);
  const [saving, setSaving] = useState(false);

  const roleM = useMutation({
    mutationFn: (v: { userId: string; role: "admin" | "organizador"; grant: boolean }) => roleFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwDone(false);
    if (password.length < 8) return setPwError("A senha deve ter no mínimo 8 caracteres.");
    if (password !== confirm) return setPwError("As senhas não coincidem.");
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) return setPwError(error.message);
    setPassword("");
    setConfirm("");
    setPwDone(true);
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <UserCog className="h-5 w-5 text-primary" /> Perfil e acessos
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Conectado como <span className="font-medium text-foreground">{ctx.data?.email ?? "—"}</span>
        </p>
      </header>

      <section className="max-w-md rounded-lg border border-border bg-card p-6">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <KeyRound className="h-4 w-4 text-primary" /> Alterar minha senha
        </h2>
        <form onSubmit={changePassword} className="mt-4 space-y-3">
          <label className="block text-xs font-medium">
            Nova senha
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block text-xs font-medium">
            Confirmar nova senha
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputCls}
            />
          </label>
          {pwError && (
            <p className="flex items-center gap-1.5 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" /> {pwError}
            </p>
          )}
          {pwDone && (
            <p className="flex items-center gap-1.5 text-sm text-primary">
              <CheckCircle2 className="h-4 w-4" /> Senha alterada com sucesso.
            </p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar nova senha"}
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <ShieldCheck className="h-4 w-4 text-primary" /> Usuários e permissões
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Administradores têm acesso total. Organizadores são registrados para fins de identificação da comissão.
          </p>
        </div>
        {roleM.error && <p className="text-sm text-destructive">{(roleM.error as Error).message}</p>}
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Último acesso</th>
                <th className="px-4 py-2">Papéis</th>
                <th className="px-4 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {(users.data ?? []).map((u) => {
                const isAdmin = u.roles.includes("admin");
                const isOrg = u.roles.includes("organizador");
                return (
                  <tr key={u.userId} className="border-t border-border">
                    <td className="px-4 py-2">
                      {u.email || "—"}
                      {u.isSelf && <span className="ml-2 text-xs text-muted-foreground">(você)</span>}
                    </td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {u.lastSignInAt ? new Date(u.lastSignInAt).toLocaleString("pt-BR") : "nunca"}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.length === 0 && <span className="text-xs text-muted-foreground">sem acesso</span>}
                        {u.roles.map((r) => (
                          <span key={r} className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-primary">
                            {r}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={roleM.isPending}
                          onClick={() => roleM.mutate({ userId: u.userId, role: "admin", grant: !isAdmin })}
                          className="rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
                        >
                          {isAdmin ? "Remover admin" : "Tornar admin"}
                        </button>
                        <button
                          type="button"
                          disabled={roleM.isPending}
                          onClick={() => roleM.mutate({ userId: u.userId, role: "organizador", grant: !isOrg })}
                          className="rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
                        >
                          {isOrg ? "Remover organizador" : "Tornar organizador"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {users.isLoading && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-xs text-muted-foreground">
                    Carregando...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}