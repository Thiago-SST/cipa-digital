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
        .in("status", ["voting", "registration", "draft", "closed"])
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
      .select("id, nome, descricao, status, vagas_titulares, vagas_suplentes, data_inicio_inscricao, data_fim_inscricao, data_inicio_votacao, data_fim_votacao, created_at")
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
          status: z.enum([
            "draft",
            "published",
            "registration",
            "homologation",
            "voting",
            "counting",
            "result_homologation",
            "concluded",
            "closed",
          ]),
        })
        .parse(d),
  )
  .handler(async ({ context, data }) => {
    const sb = await ensureAdmin(context.userId);
    if (data.status === "voting") {
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

export const deleteElection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = await ensureAdmin(context.userId);

    const [{ count: votes }, { count: tokens }] = await Promise.all([
      sb.from("votes").select("id", { count: "exact", head: true }).eq("election_id", data.id),
      sb.from("vote_tokens").select("id", { count: "exact", head: true }).eq("election_id", data.id),
    ]);
    if ((votes ?? 0) > 0 || (tokens ?? 0) > 0) {
      throw new Error(
        "Esta eleição já possui votos registrados e não pode ser excluída. Use o arquivamento para preservar a auditoria.",
      );
    }

    const { data: docs } = await sb
      .from("election_documents")
      .select("file_path")
      .eq("election_id", data.id);
    const paths = (docs ?? []).map((d) => d.file_path).filter((p): p is string => !!p);
    if (paths.length) await sb.storage.from("election-documents").remove(paths);

    await sb.from("candidate_challenges").delete().eq("election_id", data.id);
    await sb.from("election_notices").delete().eq("election_id", data.id);
    await sb.from("election_commission_members").delete().eq("election_id", data.id);
    await sb.from("election_documents").delete().eq("election_id", data.id);
    await sb.from("candidates").delete().eq("election_id", data.id);

    const { error } = await sb.from("elections").delete().eq("id", data.id);
    if (error) throw new Error(error.message);

    await sb.from("access_logs").insert({
      ator: context.userId,
      acao: "election.delete",
      detalhes: { electionId: data.id },
    });
    return { ok: true };
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
    const { withPhotoUrls } = await import("./photos.server");
    return withPhotoUrls(sb, list ?? []);
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

export const uploadCandidatePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        candidateId: z.string().uuid(),
        fileName: z.string().trim().min(1).max(200),
        fileBase64: z.string().min(10),
        mimeType: z.string().trim().min(3).max(120),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const sb = await ensureAdmin(context.userId);
    const { uploadCandidatePhotoFile, resolvePhotoUrl } = await import("./photos.server");
    const { data: current } = await sb
      .from("candidates")
      .select("foto_url")
      .eq("id", data.candidateId)
      .maybeSingle();
    const path = await uploadCandidatePhotoFile(sb, {
      candidateId: data.candidateId,
      fileName: data.fileName,
      fileBase64: data.fileBase64,
      mimeType: data.mimeType,
      previousPath: current?.foto_url ?? null,
    });
    const { error } = await sb.from("candidates").update({ foto_url: path }).eq("id", data.candidateId);
    if (error) throw new Error(error.message);
    return { path, url: await resolvePhotoUrl(sb, path) };
  });

export const removeCandidatePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ candidateId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = await ensureAdmin(context.userId);
    const { isStoragePath, CANDIDATE_PHOTO_BUCKET } = await import("./photos.server");
    const { data: current } = await sb
      .from("candidates")
      .select("foto_url")
      .eq("id", data.candidateId)
      .maybeSingle();
    if (isStoragePath(current?.foto_url)) {
      await sb.storage.from(CANDIDATE_PHOTO_BUCKET).remove([current!.foto_url as string]);
    }
    const { error } = await sb.from("candidates").update({ foto_url: null }).eq("id", data.candidateId);
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
  data_admissao: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
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
    const { computeElectionResults } = await import("./results.server");
    return computeElectionResults(sb, data.electionId);
  });

/* ============ ATA ============ */
export const generateAtaPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        electionId: z.string().uuid(),
        observacoes: z.string().trim().max(3000).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const sb = await ensureAdmin(context.userId);
    const { computeElectionResults } = await import("./results.server");
    const { buildAtaApuracaoPdf } = await import("./ata-pdf.server");

    const results = await computeElectionResults(sb, data.electionId);
    const [{ data: org }, { data: commission }] = await Promise.all([
      sb.from("organization_settings").select("nome, cnpj, endereco").limit(1).maybeSingle(),
      sb
        .from("election_commission_members")
        .select("nome, papel, matricula")
        .eq("election_id", data.electionId)
        .order("papel"),
    ]);

    const emitidoEm = new Date().toISOString();
    const bytes = await buildAtaApuracaoPdf({
      org: {
        nome: org?.nome ?? "Organização",
        cnpj: org?.cnpj ?? null,
        endereco: org?.endereco ?? null,
      },
      election: results.election as never,
      commission: commission ?? [],
      stats: results.stats,
      ranking: results.ranking.map((c) => ({
        posicao: c.posicao,
        nome: c.nome,
        matricula: c.matricula,
        numero: c.numero,
        votos: c.votos,
        classificacao: c.classificacao,
      })),
      empates: results.empates,
      observacoes: data.observacoes ?? null,
      emitidoEm,
    });

    const fileName = `ata-apuracao-${emitidoEm.slice(0, 10)}.pdf`;
    const path = `${data.electionId}/${Date.now()}-${fileName}`;
    const { error: upErr } = await sb.storage
      .from("election-documents")
      .upload(path, bytes, { contentType: "application/pdf", upsert: false });
    if (upErr) throw new Error(upErr.message);

    const { error: dbErr } = await sb.from("election_documents").insert({
      election_id: data.electionId,
      tipo: "apuracao",
      titulo: `Ata de Apuração — ${results.election.nome}`,
      file_path: path,
      file_name: fileName,
      created_by: context.userId,
      conteudo: { gerado_automaticamente: true, stats: results.stats },
    });
    if (dbErr) throw new Error(dbErr.message);

    await sb.from("access_logs").insert({
      ator: context.userId,
      acao: "document.ata_pdf",
      detalhes: { electionId: data.electionId },
    });

    const { data: signed } = await sb.storage.from("election-documents").createSignedUrl(path, 600);
    return { url: signed?.signedUrl ?? null, fileName };
  });

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

/* ============ DOCUMENTOS (upload de PDF) ============ */
export const uploadElectionDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        electionId: z.string().uuid(),
        tipo: z.enum(["edital", "abertura", "encerramento", "outro"]),
        titulo: z.string().trim().min(3).max(200),
        fileName: z.string().trim().min(1).max(200),
        fileBase64: z.string().min(10),
        mimeType: z.string().trim().min(3).max(120),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const sb = await ensureAdmin(context.userId);
    const bytes = Uint8Array.from(atob(data.fileBase64), (c) => c.charCodeAt(0));
    const safeName = data.fileName.replace(/[^\w.\-]+/g, "_");
    const path = `${data.electionId}/${Date.now()}-${safeName}`;
    const { error: upErr } = await sb.storage
      .from("election-documents")
      .upload(path, bytes, { contentType: data.mimeType, upsert: false });
    if (upErr) throw new Error(upErr.message);
    const { error: dbErr } = await sb.from("election_documents").insert({
      election_id: data.electionId,
      tipo: data.tipo,
      titulo: data.titulo,
      file_path: path,
      file_name: data.fileName,
      created_by: context.userId,
    });
    if (dbErr) throw new Error(dbErr.message);
    await sb.from("access_logs").insert({
      ator: context.userId,
      acao: "document.upload",
      detalhes: { electionId: data.electionId, tipo: data.tipo },
    });
    return { ok: true };
  });

export const getDocumentSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ path: z.string().min(1) }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = await ensureAdmin(context.userId);
    const { data: url, error } = await sb.storage
      .from("election-documents")
      .createSignedUrl(data.path, 60 * 10);
    if (error) throw new Error(error.message);
    return { url: url.signedUrl };
  });

export const deleteElectionDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = await ensureAdmin(context.userId);
    const { data: doc } = await sb
      .from("election_documents")
      .select("file_path")
      .eq("id", data.id)
      .maybeSingle();
    if (doc?.file_path) {
      await sb.storage.from("election-documents").remove([doc.file_path]);
    }
    const { error } = await sb.from("election_documents").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============ EXPORTAÇÕES CSV ============ */
function toCsv(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(";")];
  for (const r of rows) lines.push(headers.map((h) => escape(r[h])).join(";"));
  return lines.join("\n");
}

export const exportElectionData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        electionId: z.string().uuid(),
        kind: z.enum(["candidatos", "votantes", "resultado"]),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const sb = await ensureAdmin(context.userId);
    if (data.kind === "candidatos") {
      const { data: rows } = await sb
        .from("candidates")
        .select("numero, nome, matricula, setor, cargo, status, origem, created_at")
        .eq("election_id", data.electionId)
        .order("numero", { ascending: true, nullsFirst: false });
      return { csv: toCsv(rows ?? []), filename: "candidatos.csv" };
    }
    if (data.kind === "votantes") {
      const { data: tokens } = await sb
        .from("vote_tokens")
        .select("voted_at, employees(nome, matricula, setor)")
        .eq("election_id", data.electionId);
      const flat = (tokens ?? []).map((t) => ({
        nome: (t.employees as { nome?: string } | null)?.nome ?? "",
        matricula: (t.employees as { matricula?: string } | null)?.matricula ?? "",
        setor: (t.employees as { setor?: string } | null)?.setor ?? "",
        votou_em: t.voted_at,
      }));
      return { csv: toCsv(flat), filename: "votantes.csv" };
    }
    // resultado
    const { data: votes } = await sb
      .from("votes")
      .select("candidate_id, tipo")
      .eq("election_id", data.electionId);
    const { data: cands } = await sb
      .from("candidates")
      .select("id, numero, nome, matricula, setor")
      .eq("election_id", data.electionId)
      .eq("status", "approved");
    const tally = new Map<string, number>();
    let brancos = 0;
    let nulos = 0;
    (votes ?? []).forEach((v) => {
      if (v.tipo === "branco") brancos += 1;
      else if (v.tipo === "nulo") nulos += 1;
      else if (v.candidate_id)
        tally.set(v.candidate_id, (tally.get(v.candidate_id) ?? 0) + 1);
    });
    const rows = (cands ?? [])
      .map((c) => ({
        numero: c.numero ?? "",
        nome: c.nome,
        matricula: c.matricula,
        setor: c.setor ?? "",
        votos: tally.get(c.id) ?? 0,
      }))
      .sort((a, b) => Number(b.votos) - Number(a.votos));
    rows.push({ numero: "", nome: "Votos em branco", matricula: "", setor: "", votos: brancos });
    rows.push({ numero: "", nome: "Votos nulos", matricula: "", setor: "", votos: nulos });
    return { csv: toCsv(rows), filename: "resultado.csv" };
  });

/* ============ CONFIGURAÇÕES DA ORGANIZAÇÃO ============ */
const orgSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  cnpj: z.string().trim().max(20).optional().nullable(),
  endereco: z.string().trim().max(300).optional().nullable(),
  mandato_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  mandato_fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  texto_edital: z.string().trim().max(4000).optional().nullable(),
});

export const getOrgSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await ensureAdmin(context.userId);
    const { data } = await sb.from("organization_settings").select("*").limit(1).maybeSingle();
    return data;
  });

export const updateOrgSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orgSchema.parse(d))
  .handler(async ({ context, data }) => {
    const sb = await ensureAdmin(context.userId);
    const { data: existing } = await sb
      .from("organization_settings")
      .select("id")
      .limit(1)
      .maybeSingle();
    const payload = { ...data, updated_by: context.userId, updated_at: new Date().toISOString() };
    if (existing) {
      const { error } = await sb.from("organization_settings").update(payload).eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await sb
        .from("organization_settings")
        .insert({ ...payload, singleton: true });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/* ============ AUDITORIA ============ */
export const listAuditEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        acao: z.string().trim().max(80).optional().nullable(),
        ator: z.string().trim().max(120).optional().nullable(),
        desde: z.string().optional().nullable(),
        ate: z.string().optional().nullable(),
        page: z.number().int().min(0).max(500).optional(),
        pageSize: z.number().int().min(10).max(200).optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    const sb = await ensureAdmin(context.userId);
    const page = data.page ?? 0;
    const pageSize = data.pageSize ?? 50;

    let query = sb.from("access_logs").select("*", { count: "exact" });
    if (data.acao) query = query.ilike("acao", `${data.acao}%`);
    if (data.ator) query = query.ilike("ator", `%${data.ator}%`);
    if (data.desde) query = query.gte("created_at", new Date(data.desde).toISOString());
    if (data.ate) query = query.lte("created_at", new Date(`${data.ate.slice(0, 10)}T23:59:59`).toISOString());

    const { data: rows, count } = await query
      .order("created_at", { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize - 1);

    return { rows: rows ?? [], total: count ?? 0, page, pageSize };
  });

export const exportAuditCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        acao: z.string().trim().max(80).optional().nullable(),
        ator: z.string().trim().max(120).optional().nullable(),
        desde: z.string().optional().nullable(),
        ate: z.string().optional().nullable(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    const sb = await ensureAdmin(context.userId);
    let query = sb.from("access_logs").select("created_at, ator, acao, ip, detalhes");
    if (data.acao) query = query.ilike("acao", `${data.acao}%`);
    if (data.ator) query = query.ilike("ator", `%${data.ator}%`);
    if (data.desde) query = query.gte("created_at", new Date(data.desde).toISOString());
    if (data.ate) query = query.lte("created_at", new Date(`${data.ate.slice(0, 10)}T23:59:59`).toISOString());
    const { data: rows } = await query.order("created_at", { ascending: false }).limit(5000);
    const csv = toCsv(
      (rows ?? []).map((r) => ({
        data: r.created_at,
        ator: r.ator ?? "",
        acao: r.acao,
        ip: r.ip ?? "",
        detalhes: r.detalhes ? JSON.stringify(r.detalhes) : "",
      })),
    );
    return { filename: `auditoria-${new Date().toISOString().slice(0, 10)}.csv`, csv };
  });

/* ============ USUÁRIOS / PAPÉIS ============ */
export const listAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await ensureAdmin(context.userId);
    const { data: roles } = await sb.from("user_roles").select("id, user_id, role, created_at");
    const { data: usersPage } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
    const emailById = new Map((usersPage?.users ?? []).map((u) => [u.id, u.email ?? ""]));
    return (usersPage?.users ?? []).map((u) => ({
      userId: u.id,
      email: u.email ?? "",
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at ?? null,
      roles: (roles ?? []).filter((r) => r.user_id === u.id).map((r) => r.role as string),
      isSelf: u.id === context.userId,
      _email: emailById.get(u.id),
    }));
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(["admin", "organizador"]),
        grant: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const sb = await ensureAdmin(context.userId);

    if (!data.grant && data.role === "admin") {
      if (data.userId === context.userId) {
        throw new Error("Você não pode remover o seu próprio acesso de administrador.");
      }
      const { count } = await sb
        .from("user_roles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin");
      if ((count ?? 0) <= 1) throw new Error("É necessário manter ao menos um administrador.");
    }

    if (data.grant) {
      const { error } = await sb
        .from("user_roles")
        .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await sb
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role);
      if (error) throw new Error(error.message);
    }

    await sb.from("access_logs").insert({
      ator: context.userId,
      acao: data.grant ? "role.grant" : "role.revoke",
      detalhes: { userId: data.userId, role: data.role },
    });
    return { ok: true };
  });

/* ============ MARCOS TEMPORAIS (mandato / posse / edital) ============ */
export const updateElectionMilestones = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        mandato_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
        mandato_fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
        data_posse: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const sb = await ensureAdmin(context.userId);
    const { id, ...rest } = data;
    const { error } = await sb.from("elections").update(rest).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============ COMISSÃO ELEITORAL ============ */
const commissionSchema = z.object({
  id: z.string().uuid().optional(),
  election_id: z.string().uuid(),
  nome: z.string().trim().min(2).max(120),
  matricula: z.string().trim().max(30).optional().nullable(),
  papel: z.enum(["presidente", "secretario", "membro"]),
});

export const listCommission = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ electionId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = await ensureAdmin(context.userId);
    const { data: rows } = await sb
      .from("election_commission_members")
      .select("*")
      .eq("election_id", data.electionId)
      .order("papel");
    return rows ?? [];
  });

export const upsertCommissionMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => commissionSchema.parse(d))
  .handler(async ({ context, data }) => {
    const sb = await ensureAdmin(context.userId);
    if (data.id) {
      const { error } = await sb.from("election_commission_members").update(data).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: c, error } = await sb
      .from("election_commission_members")
      .insert(data)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: c.id };
  });

export const deleteCommissionMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = await ensureAdmin(context.userId);
    const { error } = await sb.from("election_commission_members").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============ IMPUGNAÇÕES ============ */
export const listChallenges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ electionId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = await ensureAdmin(context.userId);
    const { data: rows } = await sb
      .from("candidate_challenges")
      .select("*, candidates(nome, matricula, numero)")
      .eq("election_id", data.electionId)
      .order("created_at", { ascending: false });
    return rows ?? [];
  });

/**
 * Lista impugnações de todas as eleições, com filtros de eleição, decisão e busca textual.
 */
export const listAllChallenges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        electionId: z.string().uuid().nullable().optional(),
        decisao: z.enum(["pendente", "deferido", "indeferido"]).nullable().optional(),
        busca: z.string().trim().max(120).nullable().optional(),
        somentePeriodoAtivo: z.boolean().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    const sb = await ensureAdmin(context.userId);

    const { data: elections } = await sb
      .from("elections")
      .select("id, nome, status")
      .order("created_at", { ascending: false });

    const activeIds = (elections ?? [])
      .filter((e) => e.status === "registration" || e.status === "homologation")
      .map((e) => e.id);

    let query = sb
      .from("candidate_challenges")
      .select("*, candidates(nome, matricula, numero)")
      .order("created_at", { ascending: false });

    if (data.electionId) query = query.eq("election_id", data.electionId);
    if (data.decisao) query = query.eq("decisao", data.decisao);
    if (data.somentePeriodoAtivo) {
      if (activeIds.length === 0) {
        return { rows: [], elections: elections ?? [], activeIds };
      }
      query = query.in("election_id", activeIds);
    }
    if (data.busca) {
      const t = data.busca.replace(/[%,]/g, " ");
      query = query.or(`autor_nome.ilike.%${t}%,autor_matricula.ilike.%${t}%,motivo.ilike.%${t}%`);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    return { rows: rows ?? [], elections: elections ?? [], activeIds };
  });

export const judgeChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        decisao: z.enum(["deferido", "indeferido"]),
        justificativa: z.string().trim().max(1000).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const sb = await ensureAdmin(context.userId);
    const { data: ch } = await sb
      .from("candidate_challenges")
      .select("candidate_id")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await sb
      .from("candidate_challenges")
      .update({
        decisao: data.decisao,
        justificativa: data.justificativa ?? null,
        decidido_em: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    // Se deferida (candidatura invalidada), rejeita o candidato
    if (data.decisao === "deferido" && ch?.candidate_id) {
      await sb.from("candidates").update({ status: "rejected" }).eq("id", ch.candidate_id);
    }
    await sb.from("access_logs").insert({
      ator: context.userId,
      acao: `challenge.${data.decisao}`,
      detalhes: { challengeId: data.id },
    });
    return { ok: true };
  });

/* ============ AVISOS OFICIAIS ============ */
const noticeSchema = z.object({
  id: z.string().uuid().optional(),
  election_id: z.string().uuid(),
  tipo: z.enum([
    "edital",
    "homologacao_inscricoes",
    "abertura_votacao",
    "encerramento_votacao",
    "resultado",
    "homologacao_resultado",
    "posse",
    "geral",
  ]),
  titulo: z.string().trim().min(3).max(200),
  corpo: z.string().trim().min(3).max(4000),
});

export const listNotices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ electionId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = await ensureAdmin(context.userId);
    const { data: rows } = await sb
      .from("election_notices")
      .select("*")
      .eq("election_id", data.electionId)
      .order("publicado_em", { ascending: false });
    return rows ?? [];
  });

export const publishNotice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => noticeSchema.parse(d))
  .handler(async ({ context, data }) => {
    const sb = await ensureAdmin(context.userId);
    if (data.id) {
      const { error } = await sb.from("election_notices").update(data).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: n, error } = await sb.from("election_notices").insert(data).select("id").single();
    if (error) throw new Error(error.message);
    await sb.from("access_logs").insert({
      ator: context.userId,
      acao: `notice.${data.tipo}`,
      detalhes: { electionId: data.election_id, titulo: data.titulo },
    });
    return { id: n.id };
  });

export const deleteNotice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = await ensureAdmin(context.userId);
    const { error } = await sb.from("election_notices").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============ HOMOLOGAÇÕES E ARQUIVAMENTO ============ */
export const homologateRegistrations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = await ensureAdmin(context.userId);
    const { error } = await sb
      .from("elections")
      .update({ data_homologacao_inscricoes: new Date().toISOString(), status: "homologation" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await sb.from("access_logs").insert({
      ator: context.userId,
      acao: "election.homologate_registrations",
      detalhes: { electionId: data.id },
    });
    return { ok: true };
  });

export const homologateResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = await ensureAdmin(context.userId);
    const { error } = await sb
      .from("elections")
      .update({ data_homologacao_resultado: new Date().toISOString(), status: "result_homologation" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await sb.from("access_logs").insert({
      ator: context.userId,
      acao: "election.homologate_result",
      detalhes: { electionId: data.id },
    });
    return { ok: true };
  });

export const archiveElection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), arquivada: z.boolean() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const sb = await ensureAdmin(context.userId);
    const patch: { arquivada: boolean; status?: "concluded" } = { arquivada: data.arquivada };
    if (data.arquivada) patch.status = "concluded";
    const { error } = await sb.from("elections").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    await sb.from("access_logs").insert({
      ator: context.userId,
      acao: data.arquivada ? "election.archive" : "election.unarchive",
      detalhes: { electionId: data.id },
    });
    return { ok: true };
  });

/* ============ MONITORAMENTO AO VIVO ============ */
export const getElectionLiveMonitor = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ electionId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = await ensureAdmin(context.userId);
    const { computeElectionResults } = await import("./results.server");
    const [results, { data: votes }, { data: tokens }] =
      await Promise.all([
        computeElectionResults(sb, data.electionId),
        sb
          .from("votes")
          .select("candidate_id, tipo, created_at")
          .eq("election_id", data.electionId)
          .order("created_at", { ascending: true }),
        sb
          .from("vote_tokens")
          .select("voted_at")
          .eq("election_id", data.electionId)
          .order("voted_at", { ascending: false })
          .limit(20),
      ]);

    // Ranking unificado: mesma ordenação e desempate da apuração oficial.
    const ranking = results.ranking;

    // Buckets de 5 minutos nos últimos 60 minutos
    const now = Date.now();
    const bucketMs = 5 * 60 * 1000;
    const bucketCount = 12;
    const buckets: Array<{ ts: string; votos: number }> = [];
    for (let i = bucketCount - 1; i >= 0; i--) {
      const start = now - (i + 1) * bucketMs;
      const end = now - i * bucketMs;
      const count = (votes ?? []).filter((v) => {
        const t = new Date(v.created_at).getTime();
        return t >= start && t < end;
      }).length;
      buckets.push({ ts: new Date(end).toISOString(), votos: count });
    }

    return {
      election: results.election,
      ranking,
      empates: results.empates,
      empatesComAdmissaoFaltante: results.empatesComAdmissaoFaltante,
      buckets,
      recentVotes: (tokens ?? []).map((t) => ({ voted_at: t.voted_at })),
      stats: {
        totalVotos: results.stats.totalVotos,
        nominais: results.stats.votosNominais,
        brancos: results.stats.votosBrancos,
        nulos: results.stats.votosNulos,
        eleitoresQueVotaram: results.stats.eleitoresQueVotaram,
        eleitoresAptos: results.stats.eleitoresAptos,
        vagasTitulares: results.stats.vagasTitulares,
        vagasSuplentes: results.stats.vagasSuplentes,
      },
      generatedAt: new Date().toISOString(),
    };
  });