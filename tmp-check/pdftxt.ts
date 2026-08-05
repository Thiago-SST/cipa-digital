import { readFileSync } from "fs";
import { inflateSync } from "zlib";
const s = readFileSync("/tmp/browser/homolog/ata.pdf").toString("latin1");
const re = /stream\r?\n([\s\S]*?)endstream/g;
let m;
while ((m = re.exec(s))) {
  const raw = Buffer.from(m[1]!, "latin1");
  let t = "";
  try { t = inflateSync(raw).toString("latin1"); } catch { t = raw.toString("latin1"); }
  if (t.includes("Tj") || t.includes("TJ")) console.log(t.slice(0, 4000));
}
