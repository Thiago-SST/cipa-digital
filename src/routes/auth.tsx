import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { ShieldCheck, LogIn, AlertCircle, MailCheck } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Acesso administrativo — CIPA" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/reset-password",
        });
        if (error) throw error;
        setNotice("Se o email estiver cadastrado, você receberá um link para redefinir a senha.");
      } else {
        const fn =
          mode === "signin"
            ? supabase.auth.signInWithPassword({ email, password })
            : supabase.auth.signUp({
                email,
                password,
                options: { emailRedirectTo: window.location.origin + "/admin" },
              });
        const { error } = await fn;
        if (error) throw error;
        await router.invalidate();
        navigate({ to: "/admin" });
      }
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
              <div className="text-sm font-semibold leading-tight">Acesso administrativo</div>
            </div>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-md px-6 py-16">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {mode === "signin"
            ? "Entrar no painel"
            : mode === "signup"
              ? "Criar conta"
              : "Recuperar senha"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "forgot"
            ? "Informe seu email cadastrado para receber o link de redefinição."
            : "Acesso restrito à comissão organizadora. O primeiro usuário cadastrado pode se promover a administrador."}
        </p>

        <form onSubmit={submit} className="mt-8 space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
          <div>
            <label className="text-sm font-medium text-foreground" htmlFor="email">
              Email corporativo
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
            />
          </div>
          {mode !== "forgot" && (
            <div>
              <label className="text-sm font-medium text-foreground" htmlFor="password">
                Senha
              </label>
              <input
                id="password"
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
              />
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {notice && (
            <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
              <MailCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{notice}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            <LogIn className="h-4 w-4" />
            {loading
              ? "Aguarde..."
              : mode === "signin"
                ? "Entrar"
                : mode === "signup"
                  ? "Criar conta"
                  : "Enviar link"}
          </button>

          <div className="flex flex-col gap-1 text-center text-xs">
            {mode === "signin" && (
              <>
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Não tenho conta — criar agora
                </button>
                <button
                  type="button"
                  onClick={() => setMode("forgot")}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Esqueci minha senha
                </button>
              </>
            )}
            {mode !== "signin" && (
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="text-muted-foreground hover:text-foreground"
              >
                Voltar ao login
              </button>
            )}
          </div>
        </form>
      </main>
    </div>
  );
}