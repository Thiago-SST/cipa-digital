import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Vote, Users, LogOut, ShieldCheck, FileText, Settings, ScrollText, UserCog, Gavel } from "lucide-react";
import type { ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";

const nav = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/eleicoes", label: "Eleições", icon: Vote },
  { to: "/admin/empregados", label: "Empregados", icon: Users },
  { to: "/admin/impugnacoes", label: "Impugnações", icon: Gavel },
  { to: "/admin/atas", label: "Atas e documentos", icon: FileText },
  { to: "/admin/auditoria", label: "Auditoria", icon: ScrollText },
  { to: "/admin/perfil", label: "Perfil e acessos", icon: UserCog },
  { to: "/admin/configuracoes", label: "Configurações", icon: Settings },
];

export function AdminShell({ children, email }: { children: ReactNode; email?: string | null }) {
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 border-r border-border bg-sidebar text-sidebar-foreground md:flex md:flex-col">
        <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border/40">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest opacity-80">CIPA · Admin</div>
            <div className="text-sm font-semibold">Painel de Gestão</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-3 py-4 text-sm">
          {nav.map((n) => {
            const active = n.exact ? path === n.to : path.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-2 rounded-md px-3 py-2 transition ${
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "opacity-80 hover:bg-sidebar-accent hover:opacity-100"
                }`}
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border/40 px-4 py-4 text-xs">
          <div className="opacity-80 truncate">{email}</div>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth" });
            }}
            className="mt-2 inline-flex items-center gap-1 opacity-80 hover:opacity-100"
          >
            <LogOut className="h-3.5 w-3.5" /> Sair
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}