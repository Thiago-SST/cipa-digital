import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

export function VoterShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest opacity-80">CIPA</div>
              <div className="text-sm font-semibold leading-tight">Sistema de Eleição</div>
            </div>
          </Link>
          <div className="text-xs opacity-80">Gestão 2026/2027</div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">{children}</main>
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        Sistema de Eleição da CIPA · Voto sigiloso e auditável
      </footer>
    </div>
  );
}