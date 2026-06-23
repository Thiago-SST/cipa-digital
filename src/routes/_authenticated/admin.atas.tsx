import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";

import { listElections, listAtas } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/atas")({
  component: AtasPage,
});

function AtasPage() {
  const fnEl = useServerFn(listElections);
  const q = useQuery({ queryKey: ["admin-elections"], queryFn: () => fnEl() });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Atas e documentos</h1>
        <p className="mt-1 text-sm text-muted-foreground">Documentos comprobatórios por eleição.</p>
      </header>
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : !q.data?.length ? (
        <p className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">Nenhuma eleição.</p>
      ) : (
        <div className="space-y-4">
          {q.data.map((el) => <ElectionAtas key={el.id} id={el.id} nome={el.nome} />)}
        </div>
      )}
    </div>
  );
}

function ElectionAtas({ id, nome }: { id: string; nome: string }) {
  const fn = useServerFn(listAtas);
  const q = useQuery({ queryKey: ["admin-atas", id], queryFn: () => fn({ data: { electionId: id } }) });
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{nome}</h2>
        <Link to="/admin/eleicoes/$id" params={{ id }} className="text-xs text-primary hover:underline">Abrir eleição</Link>
      </div>
      <ul className="mt-3 space-y-1.5 text-sm">
        {q.data?.length ? q.data.map((a) => (
          <li key={a.id} className="flex items-center gap-2 text-muted-foreground">
            <FileText className="h-3.5 w-3.5 text-primary" />
            <span className="text-foreground">{a.titulo}</span>
            <span className="text-xs">· {new Date(a.created_at).toLocaleString("pt-BR")}</span>
          </li>
        )) : <li className="text-xs text-muted-foreground">Nenhum documento arquivado.</li>}
      </ul>
    </section>
  );
}