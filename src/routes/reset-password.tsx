import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, KeyRound, AlertCircle, CheckCircle2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({ meta: [{ title: "Redefinir senha — CIPA" }, { name: "robots", content: "noindex" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase parses the recovery hash automatically on load and emits PASSWORD_RECOVERY.
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setHasSession(!!data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setHasSession(true);
      setReady(true);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("A senha deve ter no mínimo 8 caracteres.");
    if (password !== confirm) return setError("As senhas não coincidem.");
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      await supabase.auth.signOut();
      setTimeout(() => navigate({ to: "/auth" }), 1800);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest opacity-80">CIPA</div>
              <div className="text-sm font-semibold leading-tight">Redefinir senha</div>
            </div>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-md px-6 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">Definir nova senha</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Escolha uma nova senha de acesso ao painel administrativo.
        </p>

        {!ready ? (
          <p className="mt-8 text-sm text-muted-foreground">Validando link...</p>
        ) : !hasSession ? (
          <div className="mt-8 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                Link inválido ou expirado. Volte ao{" "}
                <Link to="/auth" className="underline">
                  login
                </Link>{" "}
                e solicite um novo email de recuperação.
              </div>
            </div>
          </div>
        ) : done ? (
          <div className="mt-8 rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm text-primary">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Senha alterada! Redirecionando para o login...</span>
            </div>
          </div>
        ) : (
          <form
            onSubmit={submit}
            className="mt-8 space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm"
          >
            <div>
              <label className="text-sm font-medium" htmlFor="pw">
                Nova senha
              </label>
              <input
                id="pw"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
              />
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="cf">
                Confirmar nova senha
              </label>
              <input
                id="cf"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
              />
            </div>
            {error && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              <KeyRound className="h-4 w-4" />
              {loading ? "Salvando..." : "Salvar nova senha"}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}