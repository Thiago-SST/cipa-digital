import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { ShieldCheck, Vote, FileCheck2, Lock } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Eleição CIPA — Votação Digital" },
      { name: "description", content: "Sistema oficial de eleição da CIPA. Vote com segurança usando sua matrícula ou CPF." },
      { property: "og:title", content: "Eleição CIPA — Votação Digital" },
      { property: "og:description", content: "Sistema oficial de eleição da CIPA, em conformidade com a NR-5." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest opacity-80">Comissão Interna</div>
              <div className="text-sm font-semibold">CIPA · Sistema de Eleição</div>
            </div>
          </div>
          <nav className="hidden gap-6 text-sm md:flex">
            <a className="opacity-90 hover:opacity-100" href="#sobre">Sobre</a>
            <a className="opacity-90 hover:opacity-100" href="#processo">Processo</a>
            <a className="opacity-90 hover:opacity-100" href="#seguranca">Segurança</a>
            <Link className="opacity-90 hover:opacity-100" to="/auth">Admin</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="border-b border-border bg-secondary/40">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 md:grid-cols-[1.2fr_1fr] md:py-24">
            <div>
              <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                Gestão 2026/2027 · NR-5
              </span>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
                Eleição da CIPA, digital e auditável.
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
                Plataforma oficial para a eleição da Comissão Interna de Prevenção de
                Acidentes e de Assédio. Voto único por empregado, sigiloso e com
                registro completo para fiscalização.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/votar"
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
                >
                  <Vote className="h-4 w-4" /> Acessar a cédula
                </Link>
                <a
                  href="#processo"
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground hover:bg-muted"
                >
                  Como funciona
                </a>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Eleição em andamento
              </div>
              <div className="mt-2 text-xl font-semibold text-foreground">
                Eleição CIPA 2026/2027
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                <div className="rounded-md bg-secondary p-3">
                  <dt className="text-xs text-muted-foreground">Vagas titulares</dt>
                  <dd className="mt-1 text-2xl font-semibold text-foreground">3</dd>
                </div>
                <div className="rounded-md bg-secondary p-3">
                  <dt className="text-xs text-muted-foreground">Vagas suplentes</dt>
                  <dd className="mt-1 text-2xl font-semibold text-foreground">3</dd>
                </div>
              </dl>
              <p className="mt-5 text-xs text-muted-foreground">
                Identifique-se com sua <strong>matrícula</strong> ou <strong>CPF</strong>
                {" "}e data de nascimento.
              </p>
            </div>
          </div>
        </section>

        <section id="processo" className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-2xl font-semibold text-foreground">Como funciona</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {[
              { icon: Lock, title: "Identificação segura", text: "Matrícula ou CPF + data de nascimento para validar o eleitor." },
              { icon: Vote, title: "Voto único e sigiloso", text: "Cada empregado vota uma única vez. O voto é desvinculado do eleitor." },
              { icon: FileCheck2, title: "Apuração e atas", text: "Resultados auditáveis com atas de eleição e de apuração." },
            ].map((c) => (
              <div key={c.title} className="rounded-lg border border-border bg-card p-5 shadow-sm">
                <c.icon className="h-5 w-5 text-primary" />
                <h3 className="mt-3 text-base font-semibold text-foreground">{c.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{c.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="seguranca" className="border-t border-border bg-secondary/30">
          <div className="mx-auto max-w-6xl px-6 py-12 text-sm text-muted-foreground">
            Conforme a <strong className="text-foreground">NR-5</strong>, todas as
            ações são registradas em log para fins de auditoria e fiscalização.
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-sidebar py-6 text-center text-xs text-sidebar-foreground/80">
        Sistema de Eleição da CIPA · Uso institucional
      </footer>
    </div>
  );
}
