import { computeElectionResults } from "../src/lib/results.server";
import { createClient } from "@supabase/supabase-js";
const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb = createClient(url, key, { auth: { persistSession: false } });
const r = await computeElectionResults(sb as any, "00000000-0000-0000-0000-0000000000aa");
console.log(r.ranking.map((c: any) => [c.posicao, c.nome, c.votos, c.data_admissao, c.classificacao]));
console.log(JSON.stringify(r.empates, null, 1));
console.log(r.stats);
