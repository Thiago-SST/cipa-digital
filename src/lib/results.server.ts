import type { SupabaseClient } from "@supabase/supabase-js";

type AnySupabase = SupabaseClient<any, any, any>;

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
        .select("id, nome, matricula, setor, cargo, numero, status, created_at")
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

  const ordered = (candidates ?? [])
    .map((c: any) => ({ ...c, votos: tally.get(c.id) ?? 0 }))
    .sort(
      (a: any, b: any) =>
        b.votos - a.votos ||
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime() ||
        (a.numero ?? 9999) - (b.numero ?? 9999),
    );

  const ranking = ordered.map((c: any, i: number) => {
    const posicao = i + 1;
    const classificacao: "titular" | "suplente" | "nao_eleito" =
      posicao <= vagasTit ? "titular" : posicao <= vagasTit + vagasSup ? "suplente" : "nao_eleito";
    return { ...c, posicao, classificacao };
  });

  return {
    election: el!,
    ranking,
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