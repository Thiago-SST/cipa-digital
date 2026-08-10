import { AlertTriangle, RefreshCw } from "lucide-react";

export function QueryError({
  error,
  onRetry,
  title = "Não foi possível carregar os dados.",
  pending,
}: {
  error: unknown;
  onRetry: () => void;
  title?: string;
  pending?: boolean;
}) {
  const raw = error instanceof Error ? error.message : String(error ?? "Erro desconhecido");
  const isAuth = /401|unauthor|jwt|token|sess(ã|a)o/i.test(raw);

  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground break-words">{raw}</p>
          <p className="text-xs text-muted-foreground">
            {isAuth
              ? "Sua sessão pode ter expirado. Tente novamente ou faça login de novo."
              : "Tente novamente ou faça login de novo se o problema persistir."}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={onRetry}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} /> Tentar novamente
            </button>
            <a
              href="/auth"
              className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              Fazer login novamente
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
