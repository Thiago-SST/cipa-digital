import { computeElectionResults } from "../src/lib/results.server";
import { buildAtaApuracaoPdf } from "../src/lib/ata-pdf.server";
import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const r = await computeElectionResults(sb as any, "00000000-0000-0000-0000-0000000000aa");
const bytes = await buildAtaApuracaoPdf({
  org: { nome: "Org Homologação", cnpj: null, endereco: null },
  election: r.election as never,
  commission: [{ nome: "Fulano", papel: "presidente", matricula: "H005" }],
  stats: r.stats,
  ranking: r.ranking.map((c: any) => ({ posicao: c.posicao, nome: c.nome, matricula: c.matricula, numero: c.numero, votos: c.votos, classificacao: c.classificacao })),
  empates: r.empates,
  observacoes: "Teste de homologação",
  emitidoEm: new Date().toISOString(),
});
await Bun.write("/tmp/browser/homolog/ata.pdf", bytes);
console.log("PDF bytes:", bytes.length);
