import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldAlert, Sparkles } from "lucide-react";

import { getAdminContext, bootstrapFirstAdmin } from "@/lib/admin.functions";
import { AdminShell } from "@/components/admin-shell";
import { QueryError } from "@/components/query-error";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Painel — Eleição CIPA" }] }),
  component: AdminLayout,
});

function AdminLayout() {
  const ctx = useServerFn(getAdminContext);
  const promote = useServerFn(bootstrapFirstAdmin);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const q = useQuery({ queryKey: ["admin-ctx"], queryFn: () => ctx() });
  const m = useMutation({
    mutationFn: () => promote(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-ctx"] }),
  });

  if (q.isLoading) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Carregando...</div>;
  }
  if (q.isError || !q.data) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <div className="w-full max-w-md">
          <QueryError
            error={q.error}
            pending={q.isFetching}
            onRetry={() => q.refetch()}
            title="Não foi possível verificar seu acesso administrativo."
          />
        </div>
      </div>
    );
  }
  const data = q.data!;

  if (!data.isAdmin) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <div className="max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-sm">
          <ShieldAlert className="mx-auto h-10 w-10 text-primary" />
          <h1 className="mt-3 text-lg font-semibold">Acesso restrito</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sua conta <strong>{data.email}</strong> não tem permissão de administrador.
          </p>
          {!data.hasAnyAdmin ? (
            <>
              <p className="mt-4 text-sm text-foreground">
                Nenhum administrador cadastrado ainda. Você pode se tornar o primeiro.
              </p>
              <button
                onClick={() => m.mutate()}
                disabled={m.isPending}
                className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                <Sparkles className="h-4 w-4" />
                {m.isPending ? "Promovendo..." : "Tornar-me administrador"}
              </button>
              {m.isError && (
                <p className="mt-2 text-xs text-destructive">{(m.error as Error).message}</p>
              )}
            </>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Peça a um administrador existente para liberar seu acesso.
            </p>
          )}
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth" });
            }}
            className="mt-6 text-xs text-muted-foreground hover:text-foreground"
          >
            Sair
          </button>
        </div>
      </div>
    );
  }

  return (
    <AdminShell email={data.email}>
      <Outlet />
    </AdminShell>
  );
}