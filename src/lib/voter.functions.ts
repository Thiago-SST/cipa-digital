import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const onlyDigits = (s: string) => s.replace(/\D/g, "");

const loginSchema = z.object({
  identificador: z.string().trim().min(3).max(30),
  dataNascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
});

const voteSchema = z.object({
  candidateId: z.string().uuid().nullable(),
  tipo: z.enum(["nominal", "branco", "nulo"]),
});

const candidacySchema = z.object({
  cargo: z.string().trim().max(80).optional().nullable(),
  setor: z.string().trim().max(80).optional().nullable(),
  proposta: z.string().trim().min(10).max(1000),
});

function isWithinWindow(start: string | null, end: string | null): boolean {
  const now = Date.now();
  if (start && now < new Date(start).getTime()) return false;
  if (end && now > new Date(end).getTime()) return false;
  return true;
}

/**
 * Público: retorna o estado atual da eleição para a home do eleitor.
 * Sem autenticação — apenas metadados públicos.
 */
export const getActiveElectionInfo = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: election } = await supabaseAdmin
    .from("elections")
    .select(
      "id, nome, descricao, status, data_inicio_inscricao, data_fim_inscricao, data_inicio_votacao, data_fim_votacao, vagas_titulares, vagas_suplentes",
    )
    .in("status", ["voting", "registration"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!election) return { election: null };

  const votingOpen =
    election.status === "voting" &&
    isWithinWindow(election.data_inicio_votacao, election.data_fim_votacao);
  const registrationOpen =
    election.status === "registration" &&
    isWithinWindow(election.data_inicio_inscricao, election.data_fim_inscricao);

  return { election, votingOpen, registrationOpen };
});

export const voterLogin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => loginSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getVoterSession } = await import("./voter-session.server");

    const raw = data.identificador.trim();
    const digits = onlyDigits(raw);

    // Procura por matrícula OU CPF
    const { data: emp, error } = await supabaseAdmin
      .from("employees")
      .select("id, nome, matricula, cpf, data_nascimento, ativo")
      .or(`matricula.eq.${raw},cpf.eq.${digits}`)
      .maybeSingle();

    if (error) throw new Error("Erro ao validar credenciais.");
    if (!emp || !emp.ativo) throw new Error("Empregado não encontrado ou inativo.");
    if (emp.data_nascimento !== data.dataNascimento) {
      throw new Error("Data de nascimento não confere.");
    }

    // Eleição em votação
    const { data: election } = await supabaseAdmin
      .from("elections")
      .select("id")
      .eq("status", "voting")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!election) throw new Error("Nenhuma eleição em andamento no momento.");
    if (!isWithinWindow(null, null)) {
      // placeholder para o typechecker; a checagem real está abaixo
    }

    // Janela de votação
    const { data: elFull } = await supabaseAdmin
      .from("elections")
      .select("data_inicio_votacao, data_fim_votacao")
      .eq("id", election.id)
      .maybeSingle();
    if (elFull && !isWithinWindow(elFull.data_inicio_votacao, elFull.data_fim_votacao)) {
      throw new Error("A votação não está aberta neste horário.");
    }

    const session = await getVoterSession();
    await session.update({
      employeeId: emp.id,
      electionId: election.id,
      nome: emp.nome,
      matricula: emp.matricula,
    });

    await supabaseAdmin.from("access_logs").insert({
      ator: emp.matricula,
      acao: "voter.login",
      detalhes: { electionId: election.id },
    });

    return { ok: true };
  });

export const voterLogout = createServerFn({ method: "POST" }).handler(async () => {
  const { getVoterSession } = await import("./voter-session.server");
  const session = await getVoterSession();
  await session.clear();
  return { ok: true };
});

export const getVoterBallot = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { getVoterSession } = await import("./voter-session.server");

  const session = await getVoterSession();
  if (!session.data.employeeId || !session.data.electionId) {
    return { authenticated: false as const };
  }

  const [{ data: election }, { data: candidates }, { data: token }] = await Promise.all([
    supabaseAdmin
      .from("elections")
      .select("id, nome, descricao, data_fim_votacao, vagas_titulares, vagas_suplentes, status")
      .eq("id", session.data.electionId)
      .maybeSingle(),
    supabaseAdmin
      .from("candidates")
      .select("id, nome, matricula, setor, cargo, proposta, foto_url, numero")
      .eq("election_id", session.data.electionId)
      .eq("status", "approved")
      .order("numero", { ascending: true }),
    supabaseAdmin
      .from("vote_tokens")
      .select("voted_at")
      .eq("election_id", session.data.electionId)
      .eq("employee_id", session.data.employeeId)
      .maybeSingle(),
  ]);

  return {
    authenticated: true as const,
    voter: { nome: session.data.nome!, matricula: session.data.matricula! },
    election,
    candidates: candidates ?? [],
    hasVoted: !!token,
    votedAt: token?.voted_at ?? null,
  };
});

export const castVote = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => voteSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getVoterSession } = await import("./voter-session.server");

    const session = await getVoterSession();
    if (!session.data.employeeId || !session.data.electionId) {
      throw new Error("Sessão expirada. Faça login novamente.");
    }
    const electionId = session.data.electionId;
    const employeeId = session.data.employeeId;

    // Verifica eleição ativa e dentro da janela
    const { data: election } = await supabaseAdmin
      .from("elections")
      .select("id, status, data_inicio_votacao, data_fim_votacao")
      .eq("id", electionId)
      .maybeSingle();
    if (!election || election.status !== "voting") {
      throw new Error("Eleição não está em andamento.");
    }
    if (!isWithinWindow(election.data_inicio_votacao, election.data_fim_votacao)) {
      throw new Error("A votação está fora do horário permitido.");
    }

    // Se voto nominal, valida candidato
    if (data.tipo === "nominal") {
      if (!data.candidateId) throw new Error("Selecione um candidato.");
      const { data: cand } = await supabaseAdmin
        .from("candidates")
        .select("id")
        .eq("id", data.candidateId)
        .eq("election_id", electionId)
        .eq("status", "approved")
        .maybeSingle();
      if (!cand) throw new Error("Candidato inválido.");
    }

    // Token (garante voto único via UNIQUE)
    const { error: tokenErr } = await supabaseAdmin
      .from("vote_tokens")
      .insert({ election_id: electionId, employee_id: employeeId });
    if (tokenErr) {
      if (tokenErr.code === "23505") throw new Error("Você já votou nesta eleição.");
      throw new Error("Não foi possível registrar o voto.");
    }

    // Voto anônimo (sem employee_id). Nominal grava candidate_id; branco/nulo grava null.
    const { error: voteErr } = await supabaseAdmin.from("votes").insert({
      election_id: electionId,
      candidate_id: data.tipo === "nominal" ? data.candidateId : null,
      tipo: data.tipo,
    });
    if (voteErr) throw new Error("Falha ao gravar voto.");

    await supabaseAdmin.from("access_logs").insert({
      ator: session.data.matricula,
      acao: `voter.vote.${data.tipo}`,
      detalhes: { electionId },
    });

    return { ok: true };
  });

/**
 * Auto-inscrição de candidato pelo eleitor logado.
 * Requer eleição em `registration` e dentro da janela de inscrição.
 */
export const registerCandidacy = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => candidacySchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getVoterSession } = await import("./voter-session.server");
    const session = await getVoterSession();
    if (!session.data.employeeId) throw new Error("Faça login para se candidatar.");

    const { data: election } = await supabaseAdmin
      .from("elections")
      .select("id, status, data_inicio_inscricao, data_fim_inscricao")
      .in("status", ["registration"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!election) throw new Error("Não há eleição com inscrições abertas.");
    if (!isWithinWindow(election.data_inicio_inscricao, election.data_fim_inscricao)) {
      throw new Error("As inscrições estão fora do horário permitido.");
    }

    const { data: emp } = await supabaseAdmin
      .from("employees")
      .select("id, nome, matricula, setor, cargo")
      .eq("id", session.data.employeeId)
      .maybeSingle();
    if (!emp) throw new Error("Empregado não encontrado.");

    const { error } = await supabaseAdmin.from("candidates").insert({
      election_id: election.id,
      employee_id: emp.id,
      nome: emp.nome,
      matricula: emp.matricula,
      setor: data.setor ?? emp.setor,
      cargo: data.cargo ?? emp.cargo,
      proposta: data.proposta,
      status: "pending",
      origem: "auto",
    });
    if (error) {
      if (error.code === "23505") throw new Error("Você já está inscrito nesta eleição.");
      throw new Error(error.message);
    }

    await supabaseAdmin.from("access_logs").insert({
      ator: emp.matricula,
      acao: "candidate.self_register",
      detalhes: { electionId: election.id },
    });

    return { ok: true };
  });

export const getMyCandidacy = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { getVoterSession } = await import("./voter-session.server");
  const session = await getVoterSession();
  if (!session.data.employeeId) return { authenticated: false as const };

  const { data: election } = await supabaseAdmin
    .from("elections")
    .select("id, nome, status, data_inicio_inscricao, data_fim_inscricao")
    .in("status", ["registration"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!election) return { authenticated: true as const, election: null };

  const { data: cand } = await supabaseAdmin
    .from("candidates")
    .select("id, status, proposta, setor, cargo, created_at")
    .eq("election_id", election.id)
    .eq("employee_id", session.data.employeeId)
    .maybeSingle();

  return {
    authenticated: true as const,
    voter: { nome: session.data.nome!, matricula: session.data.matricula! },
    election,
    candidacy: cand,
    inWindow: isWithinWindow(election.data_inicio_inscricao, election.data_fim_inscricao),
  };
});