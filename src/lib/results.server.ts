import type { SupabaseClient } from "@supabase/supabase-js";

type AnySupabase = SupabaseClient<any, any, any>;

export type TieBreakCriterion = "admissao" | "inscricao" | "numero";

export const TIE_BREAK_LABEL: Record<TieBreakCriterion, string> = {
  admissao: "maior tempo de casa (data de admissão mais antiga)",
  inscricao: "inscrição mais antiga",
  numero: "menor número de cédula",
};

function admissaoTime(value?: string | null): number | null {
  if (!value) return null;
  const t = new Date(`${String(value).slice(0, 10)}T00:00:00Z`).getTime();
  return Number.isNaN(t) ? null : t;
}

export async function computeElectionResults(sb: AnySupabase, electionId: string) {
  const [{ data: el }, { data: candidates }, { data: votes }, { count: tokenCount }, { count: eligible }] =
    await Promise.all([
      sb
        .from("elections")
        .select(
          "id, nome, vagas_titulares, vagas_suplentes, status, data_inicio_votacao, data_fim_votacao, mandato_inicio, mandato_fim",
        )
        .eq("id", electionId)
        .single(),
      sb
        .from("candidates")
        .select(
          "id, nome, matricula, setor, cargo, numero, status, created_at, employee_id, employees(data_admissao)",
        )
        .eq("election_id", electionId)
        .eq("status", "approved"),
      sb.from("votes").select("candidate_id, tipo").eq("election_id", electionId),
      sb.from("vote_tokens").select("id", { count: "exact", head: true }).eq("election_id", electionId),
      sb.from("employees").select("id", { count: "exact", head: true }).eq("ativo", true),
    ]);

  const tally = new Map<string, number>();
  let votosNominais = 0;
  let votosBrancos = 0;
  let votosNulos = 0;
  (votes ?? []).forEach((v: { candidate_id: string | null; tipo: string }) => {
    if (v.tipo === "branco") votosBrancos += 1;
    else if (v.tipo === "nulo") votosNulos += 1;
    else if (v.candidate_id) {
      votosNominais += 1;
      tally.set(v.candidate_id, (tally.get(v.candidate_id) ?? 0) + 1);
    }
  });

  const vagasTit = el!.vagas_titulares as number;
  const vagasSup = el!.vagas_suplentes as number;

  // Ranking NR-5: 1) mais votos, 2) maior tempo de casa (admissão mais antiga),
  // 3) inscrição mais antiga, 4) menor número de cédula.
  const ordered = (candidates ?? [])
    .map((c: any) => {
      const emp = Array.isArray(c.employees) ? c.employees[0] : c.employees;
      const data_admissao: string | null = emp?.data_admissao ?? null;
      const { employees: _drop, ...rest } = c;
      return { ...rest, data_admissao, votos: tally.get(c.id) ?? 0 };
    })
    .sort((a: any, b: any) => {
      if (b.votos !== a.votos) return b.votos - a.votos;
      const admA = admissaoTime(a.data_admissao);
      const admB = admissaoTime(b.data_admissao);
      if (admA !== null && admB !== null && admA !== admB) return admA - admB;
      if (admA !== null && admB === null) return -1;
      if (admA === null && admB !== null) return 1;
      const insA = new Date(a.created_at).getTime();
      const insB = new Date(b.created_at).getTime();
      if (insA !== insB) return insA - insB;
      return (a.numero ?? 9999) - (b.numero ?? 9999);
    });

  const ranking = ordered.map((c: any, i: number) => {
    const posicao = i + 1;
    const classificacao: "titular" | "suplente" | "nao_eleito" =
      posicao <= vagasTit ? "titular" : posicao <= vagasTit + vagasSup ? "suplente" : "nao_eleito";
    return { ...c, posicao, classificacao };
  });

  // Empates reais (mesmo número de votos) e o critério que os resolveu.
  const byVotos = new Map<number, typeof ranking>();
  ranking.forEach((c) => {
    const list = byVotos.get(c.votos) ?? [];
    list.push(c);
    byVotos.set(c.votos, list);
  });

  const empates = [...byVotos.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([votos, list]) => {
      const admissoes = list.map((c) => admissaoTime(c.data_admissao));
      const semAdmissao = list.filter((c) => !c.data_admissao).map((c) => c.nome);
      const todasPresentes = admissoes.every((a) => a !== null);
      const todasDistintas = new Set(admissoes).size === admissoes.length;
      const criterio: TieBreakCriterion =
        todasPresentes && todasDistintas
          ? "admissao"
          : new Set(list.map((c) => new Date(c.created_at).getTime())).size === list.length
            ? "inscricao"
            : "numero";
      return {
        votos,
        criterio,
        criterioLabel: TIE_BREAK_LABEL[criterio],
        semAdmissao,
        candidatos: list.map((c) => ({
          posicao: c.posicao,
          nome: c.nome,
          matricula: c.matricula,
          data_admissao: c.data_admissao as string | null,
          classificacao: c.classificacao,
        })),
      };
    })
    .sort((a, b) => b.votos - a.votos);

  return {
    election: el!,
    ranking,
    empates,
    empatesComAdmissaoFaltante: empates.some((e) => e.semAdmissao.length > 0),
    titulares: ranking.filter((c) => c.classificacao === "titular"),
    suplentes: ranking.filter((c) => c.classificacao === "suplente"),
    stats: {
      totalVotos: votes?.length ?? 0,
      votosNominais,
      votosBrancos,
      votosNulos,
      eleitoresQueVotaram: tokenCount ?? 0,
      eleitoresAptos: eligible ?? 0,
      vagasTitulares: vagasTit,
      vagasSuplentes: vagasSup,
      candidatosAprovados: ranking.length,
    },
  };
}
