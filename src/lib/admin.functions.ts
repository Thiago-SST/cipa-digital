import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Acesso restrito a administradores.");
  return supabaseAdmin;
}

export const getAdminContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: myRole }, { count }] = await Promise.all([
      supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", context.userId)
        .eq("role", "admin")
        .maybeSingle(),
      supabaseAdmin.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "admin"),
    ]);
    return {
      userId: context.userId,
      email: (context.claims as { email?: string }).email ?? null,
      isAdmin: !!myRole,
      hasAnyAdmin: (count ?? 0) > 0,
    };
  });

export const bootstrapFirstAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) > 0) throw new Error("Já existe um administrador. Peça permissão a ele.");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "admin" });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("access_logs").insert({
      ator: context.userId,
      acao: "admin.bootstrap",
    });
    return { ok: true };
  });

/* ============ DASHBOARD ============ */
export const getAdminDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await ensureAdmin(context.userId);
    const [{ count: empCount }, { count: elCount }, { data: current }] = await Promise.all([
      sb.from("employees").select("id", { count: "exact", head: true }).eq("ativo", true),
      sb.from("elections").select("id", { count: "exact", head: true }),
      sb
        .from("elections")
        .select("id, nome, status, vagas_titulares, vagas_suplentes, data_fim_votacao")
        .in("status", ["voting", "inscription", "draft", "closed"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    let progress: { votes: number; eligible: number } | null = null;
    if (current) {
      const [{ count: votesCount }, { count: eligibleCount }] = await Promise.all([
        sb.from("vote_tokens").select("id", { count: "exact", head: true }).eq("election_id", current.id),
        sb.from("employees").select("id", { count: "exact", head: true }).eq("ativo", true),
      ]);
      progress = { votes: votesCount ?? 0, eligible: eligibleCount ?? 0 };
    }

    return {
      totals: { employees: empCount ?? 0, elections: elCount ?? 0 },
      currentElection: current,
      progress,
    };
  });

/* ============ ELEIÇÕES ============ */
const electionSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().trim().min(3).max(120),
  descricao: z.string().trim().max(500).optional().nullable(),
  data_inicio_inscricao: z.string().optional().nullable(),
  data_fim_inscricao: z.string().optional().nullable(),
  data_inicio_votacao: z.string().optional().nullable(),
  data_fim_votacao: z.string().optional().nullable(),
  vagas_titulares: z.number().int().min(1).max(50),
  vagas_suplentes: z.number().int().min(0).max(50),
});

export const listElections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await ensureAdmin(context.userId);
    const { data } = await sb
      .from("elections")
      .select("id, nome, status, vagas_titulares, vagas_suplentes, data_fim_votacao, created_at")
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const upsertElection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => electionSchema.parse(d))
  .handler(async ({ context, data }) => {
    const sb = await ensureAdmin(context.userId);
    if (data.id) {
      const { error } = await sb.from("elections").update(data).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: created, error } = await sb.from("elections").insert(data).select("id").single();
    if (error) throw new Error(error.message);
    return { id: created.id };
  });

export const setElectionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["draft", "inscription", "voting", "closed", "published"]),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const sb = await ensureAdmin(context.userId);
    if (data.status === "voting") {
      // Encerra outras em votação
      await sb.from("elections").update({ status: "closed" }).eq("status", "voting").neq("id", data.id);
    }
    const { error } = await sb.from("elections").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await sb.from("access_logs").insert({
      ator: context.userId,
      acao: `election.status.${data.status}`,
      detalhes: { electionId: data.id },
    });
    return { ok: true };
  });

export const getElection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = await ensureAdmin(context.userId);
    const { data: el } = await sb.from("elections").select("*").eq("id", data.id).maybeSingle();
    if (!el) throw new Error("Eleição não encontrada.");
    return el;
  });

/* ============ CANDIDATOS ============ */
const candidateSchema = z.object({
  id: z.string().uuid().optional(),
  election_id: z.string().uuid(),
  nome: z.string().trim().min(3).max(120),
  matricula: z.string().trim().min(1).max(30),
  setor: z.string().trim().max(80).optional().nullable(),
  cargo: z.string().trim().max(80).optional().nullable(),
  proposta: z.string().trim().max(1000).optional().nullable(),
  numero: z.number().int().min(1).max(9999).optional().nullable(),
  status: z.enum(["pending", "approved", "rejected"]).optional(),
});

export const listCandidates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ electionId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = await ensureAdmin(context.userId);
    const { data: list } = await sb
      .from("candidates")
      .select("*")
      .eq("election_id", data.electionId)
      .order("numero", { ascending: true, nullsFirst: false });
    return list ?? [];
  });

export const upsertCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => candidateSchema.parse(d))
  .handler(async ({ context, data }) => {
    const sb = await ensureAdmin(context.userId);
    if (data.id) {
      const { error } = await sb.from("candidates").update(data).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: c, error } = await sb.from("candidates").insert(data).select("id").single();
    if (error) throw new Error(error.message);
    return { id: c.id };
  });

export const deleteCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = await ensureAdmin(context.userId);
    const { error } = await sb.from("candidates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============ EMPREGADOS ============ */
const employeeSchema = z.object({
  id: z.string().uuid().optional(),
  matricula: z.string().trim().min(1).max(30),
  nome: z.string().trim().min(2).max(120),
  cpf: z.string().trim().max(14).optional().nullable(),
  email: z.string().email().optional().nullable(),
  setor: z.string().trim().max(80).optional().nullable(),
  cargo: z.string().trim().max(80).optional().nullable(),
  data_nascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ativo: z.boolean().optional(),
});

export const listEmployees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await ensureAdmin(context.userId);
    const { data } = await sb.from("employees").select("*").order("nome");
    return data ?? [];
  });

export const upsertEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => employeeSchema.parse(d))
  .handler(async ({ context, data }) => {
    const sb = await ensureAdmin(context.userId);
    const payload = { ...data, cpf: data.cpf ? data.cpf.replace(/\D/g, "") : null };
    if (data.id) {
      const { error } = await sb.from("employees").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: e, error } = await sb.from("employees").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: e.id };
  });

export const deleteEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = await ensureAdmin(context.userId);
    const { error } = await sb.from("employees").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const importEmployees = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ rows: z.array(employeeSchema.omit({ id: true })) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const sb = await ensureAdmin(context.userId);
    const payload = data.rows.map((r) => ({
      ...r,
      cpf: r.cpf ? r.cpf.replace(/\D/g, "") : null,
      ativo: r.ativo ?? true,
    }));
    // upsert por matricula
    const { error, count } = await sb
      .from("employees")
      .upsert(payload, { onConflict: "matricula", count: "exact" });
    if (error) throw new Error(error.message);
    return { imported: count ?? payload.length };
  });

/* ============ APURAÇÃO ============ */
export const getElectionResults = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ electionId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = await ensureAdmin(context.userId);
    const [{ data: el }, { data: candidates }, { data: votes }, { count: tokenCount }, { count: eligible }] =
      await Promise.all([
        sb
          .from("elections")
          .select("id, nome, vagas_titulares, vagas_suplentes, status")
          .eq("id", data.electionId)
          .single(),
        sb
          .from("candidates")
          .select("id, nome, matricula, setor, cargo, numero, status")
          .eq("election_id", data.electionId)
          .eq("status", "approved"),
        sb.from("votes").select("candidate_id").eq("election_id", data.electionId),
        sb
          .from("vote_tokens")
          .select("id", { count: "exact", head: true })
          .eq("election_id", data.electionId),
        sb.from("employees").select("id", { count: "exact", head: true }).eq("ativo", true),
      ]);

    const tally = new Map<string, number>();
    (votes ?? []).forEach((v) => tally.set(v.candidate_id, (tally.get(v.candidate_id) ?? 0) + 1));

    const ranking = (candidates ?? [])
      .map((c) => ({ ...c, votos: tally.get(c.id) ?? 0 }))
      .sort((a, b) => b.votos - a.votos || (a.numero ?? 9999) - (b.numero ?? 9999));

    const titulares = ranking.slice(0, el!.vagas_titulares);
    const suplentes = ranking.slice(el!.vagas_titulares, el!.vagas_titulares + el!.vagas_suplentes);

    return {
      election: el!,
      ranking,
      titulares,
      suplentes,
      stats: {
        totalVotos: votes?.length ?? 0,
        eleitoresQueVotaram: tokenCount ?? 0,
        eleitoresAptos: eligible ?? 0,
      },
    };
  });

/* ============ ATA ============ */
export const saveAta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        electionId: z.string().uuid(),
        tipo: z.enum(["abertura", "apuracao", "encerramento"]),
        titulo: z.string().trim().min(3).max(200),
        conteudo: z.record(z.any()),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const sb = await ensureAdmin(context.userId);
    const { error } = await sb.from("election_documents").insert({
      election_id: data.electionId,
      tipo: data.tipo,
      titulo: data.titulo,
      conteudo: data.conteudo,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAtas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ electionId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = await ensureAdmin(context.userId);
    const { data: list } = await sb
      .from("election_documents")
      .select("*")
      .eq("election_id", data.electionId)
      .order("created_at", { ascending: false });
    return list ?? [];
  });