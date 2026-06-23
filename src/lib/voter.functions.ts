import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const onlyDigits = (s: string) => s.replace(/\D/g, "");

const loginSchema = z.object({
  identificador: z.string().trim().min(3).max(30),
  dataNascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
});

const voteSchema = z.object({
  candidateId: z.string().uuid(),
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

    // Verifica eleição ativa
    const { data: election } = await supabaseAdmin
      .from("elections")
      .select("id, status, data_fim_votacao")
      .eq("id", electionId)
      .maybeSingle();
    if (!election || election.status !== "voting") {
      throw new Error("Eleição não está em andamento.");
    }

    // Verifica candidato
    const { data: cand } = await supabaseAdmin
      .from("candidates")
      .select("id")
      .eq("id", data.candidateId)
      .eq("election_id", electionId)
      .eq("status", "approved")
      .maybeSingle();
    if (!cand) throw new Error("Candidato inválido.");

    // Token (garante voto único via UNIQUE)
    const { error: tokenErr } = await supabaseAdmin
      .from("vote_tokens")
      .insert({ election_id: electionId, employee_id: employeeId });
    if (tokenErr) {
      if (tokenErr.code === "23505") throw new Error("Você já votou nesta eleição.");
      throw new Error("Não foi possível registrar o voto.");
    }

    // Voto anônimo (não tem employee_id)
    const { error: voteErr } = await supabaseAdmin
      .from("votes")
      .insert({ election_id: electionId, candidate_id: data.candidateId });
    if (voteErr) throw new Error("Falha ao gravar voto.");

    await supabaseAdmin.from("access_logs").insert({
      ator: session.data.matricula,
      acao: "voter.vote",
      detalhes: { electionId },
    });

    return { ok: true };
  });