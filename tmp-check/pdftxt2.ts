import { readFileSync } from "fs";
import { inflateSync } from "zlib";
const s = readFileSync("/tmp/browser/homolog/ata.pdf").toString("latin1");
let n = 0;
for (const m of s.matchAll(/stream\r?\n([\s\S]*?)endstream/g)) {
  n++;
  const raw = Buffer.from(m[1]!, "latin1");
  let t = "";
  try { t = inflateSync(raw).toString("latin1"); } catch { t = raw.toString("latin1"); }
  const hex = [...t.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)].map((x) => Buffer.from(x[1]!, "hex").toString("latin1"));
  console.log(`--- stream ${n} (${hex.length} textos) ---`);
  console.log(hex.join("\n"));
}
