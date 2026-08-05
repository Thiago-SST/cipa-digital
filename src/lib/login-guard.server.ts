import type { SupabaseClient } from "@supabase/supabase-js";

type AnySupabase = SupabaseClient<any, any, any>;

export const WINDOW_MINUTES = 15;
export const MAX_PER_IDENTIFIER = 5;
export const MAX_PER_IP = 10;

export function normalizeIdentifier(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Bloqueia temporariamente logins após tentativas erradas repetidas.
 * Lança erro com mensagem amigável quando o limite é atingido.
 */
export async function assertLoginAllowed(
  sb: AnySupabase,
  identificador: string,
  ip: string | null,
): Promise<void> {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

  const [{ data: byId }, { data: byIp }] = await Promise.all([
    sb
      .from("login_attempts")
      .select("sucesso, created_at")
      .eq("identificador", identificador)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(50),
    ip
      ? sb
          .from("login_attempts")
          .select("sucesso, created_at")
          .eq("ip", ip)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] as Array<{ sucesso: boolean; created_at: string }> }),
  ]);

  const failuresSinceSuccess = (rows: Array<{ sucesso: boolean }> | null) => {
    let n = 0;
    for (const r of rows ?? []) {
      if (r.sucesso) break;
      n += 1;
    }
    return n;
  };

  const idFails = failuresSinceSuccess(byId as any);
  const ipFails = failuresSinceSuccess(byIp as any);

  if (idFails >= MAX_PER_IDENTIFIER || ipFails >= MAX_PER_IP) {
    const rows = (idFails >= MAX_PER_IDENTIFIER ? byId : byIp) as
      | Array<{ created_at: string }>
      | null;
    const last = rows?.[0]?.created_at ? new Date(rows[0]!.created_at).getTime() : Date.now();
    const restanteMs = last + WINDOW_MINUTES * 60 * 1000 - Date.now();
    const minutos = Math.max(1, Math.ceil(restanteMs / 60000));

    await sb.from("access_logs").insert({
      ator: identificador,
      acao: "voter.login.bloqueado",
      ip,
      detalhes: {
        motivo: idFails >= MAX_PER_IDENTIFIER ? "identificador" : "ip",
        tentativas: idFails >= MAX_PER_IDENTIFIER ? idFails : ipFails,
      },
    });

    throw new Error(
      `Muitas tentativas de acesso. Tente novamente em aproximadamente ${minutos} minuto(s).`,
    );
  }
}

export async function recordLoginAttempt(
  sb: AnySupabase,
  identificador: string,
  ip: string | null,
  sucesso: boolean,
): Promise<void> {
  await sb.from("login_attempts").insert({ identificador, ip, sucesso });
}