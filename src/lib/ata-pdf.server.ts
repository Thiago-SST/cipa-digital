import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type AtaPdfInput = {
  org: {
    nome: string;
    cnpj?: string | null;
    endereco?: string | null;
  };
  election: {
    nome: string;
    vagas_titulares: number;
    vagas_suplentes: number;
    data_inicio_votacao?: string | null;
    data_fim_votacao?: string | null;
    mandato_inicio?: string | null;
    mandato_fim?: string | null;
  };
  commission: Array<{ nome: string; papel: string; matricula?: string | null }>;
  stats: {
    eleitoresAptos: number;
    eleitoresQueVotaram: number;
    totalVotos: number;
    votosNominais: number;
    votosBrancos: number;
    votosNulos: number;
  };
  ranking: Array<{
    posicao: number;
    nome: string;
    matricula: string;
    numero?: number | null;
    votos: number;
    classificacao: "titular" | "suplente" | "nao_eleito";
  }>;
  observacoes?: string | null;
  emitidoEm: string;
};

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 50;
const LINE = 14;

function fmtDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
}

function fmtDay(value?: string | null): string {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : "—";
}

const CLASSIF_LABEL: Record<string, string> = {
  titular: "Titular",
  suplente: "Suplente",
  nao_eleito: "Nao eleito",
};

export async function buildAtaApuracaoPdf(input: AtaPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage(A4);
  let y = A4[1] - MARGIN;

  const ink = rgb(0.11, 0.15, 0.13);
  const muted = rgb(0.42, 0.45, 0.44);
  const accent = rgb(0.06, 0.4, 0.24);

  function ensureSpace(needed: number) {
    if (y - needed < MARGIN) {
      page = pdf.addPage(A4);
      y = A4[1] - MARGIN;
    }
  }

  function text(
    value: string,
    opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; x?: number; gap?: number } = {},
  ) {
    const size = opts.size ?? 10;
    ensureSpace(size + 4);
    page.drawText(value, {
      x: opts.x ?? MARGIN,
      y,
      size,
      font: opts.bold ? bold : font,
      color: opts.color ?? ink,
    });
    y -= opts.gap ?? size + 5;
  }

  function rule(gap = 10) {
    ensureSpace(gap + 2);
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: A4[0] - MARGIN, y },
      thickness: 0.7,
      color: rgb(0.8, 0.82, 0.81),
    });
    y -= gap;
  }

  function wrapped(value: string, size = 10, maxWidth = A4[0] - MARGIN * 2) {
    const words = value.split(/\s+/);
    let line = "";
    for (const word of words) {
      const attempt = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(attempt, size) > maxWidth) {
        text(line, { size, gap: LINE });
        line = word;
      } else {
        line = attempt;
      }
    }
    if (line) text(line, { size, gap: LINE });
  }

  // Cabeçalho
  text(input.org.nome.toUpperCase(), { size: 14, bold: true, color: accent, gap: 18 });
  const orgLine = [input.org.cnpj ? `CNPJ ${input.org.cnpj}` : null, input.org.endereco].filter(Boolean).join(" — ");
  if (orgLine) text(orgLine, { size: 9, color: muted, gap: 16 });
  text("ATA DE APURACAO DA ELEICAO DA CIPA", { size: 13, bold: true, gap: 16 });
  text(input.election.nome, { size: 11, color: muted, gap: 8 });
  rule(16);

  // Preâmbulo
  wrapped(
    `Aos ${fmtDate(input.emitidoEm)}, reuniu-se a Comissao Eleitoral para proceder a apuracao dos votos da eleicao da Comissao Interna de Prevencao de Acidentes e de Assedio (CIPA), nos termos da Norma Regulamentadora n. 5, tendo a votacao ocorrido de ${fmtDate(input.election.data_inicio_votacao)} a ${fmtDate(input.election.data_fim_votacao)}.`,
  );
  y -= 6;

  // Comissão
  text("1. COMISSAO ELEITORAL", { size: 11, bold: true, gap: 16 });
  if (input.commission.length === 0) {
    text("Nenhum membro registrado.", { size: 10, color: muted, gap: LINE });
  } else {
    for (const m of input.commission) {
      text(`- ${m.nome}${m.matricula ? ` (matricula ${m.matricula})` : ""} — ${m.papel}`, { size: 10, gap: LINE });
    }
  }
  y -= 8;

  // Números
  text("2. NUMEROS DA APURACAO", { size: 11, bold: true, gap: 16 });
  const compar =
    input.stats.eleitoresAptos > 0
      ? Math.round((input.stats.eleitoresQueVotaram / input.stats.eleitoresAptos) * 100)
      : 0;
  const linhas = [
    `Eleitores aptos: ${input.stats.eleitoresAptos}`,
    `Eleitores que votaram: ${input.stats.eleitoresQueVotaram} (${compar}%)`,
    `Total de votos apurados: ${input.stats.totalVotos}`,
    `Votos nominais: ${input.stats.votosNominais}`,
    `Votos em branco: ${input.stats.votosBrancos}`,
    `Votos nulos: ${input.stats.votosNulos}`,
    `Vagas: ${input.election.vagas_titulares} titular(es) e ${input.election.vagas_suplentes} suplente(s)`,
    `Mandato: ${fmtDay(input.election.mandato_inicio)} a ${fmtDay(input.election.mandato_fim)}`,
  ];
  for (const l of linhas) text(l, { size: 10, gap: LINE });
  y -= 8;

  // Ranking
  text("3. RESULTADO POR CANDIDATO", { size: 11, bold: true, gap: 18 });
  const cols = [MARGIN, MARGIN + 34, MARGIN + 240, MARGIN + 320, MARGIN + 380];
  function row(values: string[], isHead = false) {
    ensureSpace(LINE + 2);
    values.forEach((v, i) => {
      page.drawText(v, {
        x: cols[i],
        y,
        size: 9,
        font: isHead ? bold : font,
        color: isHead ? muted : ink,
      });
    });
    y -= LINE;
  }
  row(["#", "Candidato", "Matricula", "Votos", "Classificacao"], true);
  rule(8);
  if (input.ranking.length === 0) {
    text("Nenhum candidato aprovado.", { size: 10, color: muted, gap: LINE });
  } else {
    for (const c of input.ranking) {
      const nome = c.nome.length > 34 ? `${c.nome.slice(0, 33)}.` : c.nome;
      row([
        String(c.posicao),
        `${nome}${c.numero ? ` (n. ${c.numero})` : ""}`,
        c.matricula,
        String(c.votos),
        CLASSIF_LABEL[c.classificacao] ?? c.classificacao,
      ]);
    }
  }
  y -= 10;

  if (input.observacoes) {
    text("4. OBSERVACOES", { size: 11, bold: true, gap: 16 });
    wrapped(input.observacoes);
    y -= 6;
  }

  // Encerramento e assinaturas
  rule(16);
  wrapped(
    "Nada mais havendo a tratar, foi lavrada a presente ata, que segue assinada pelos membros da Comissao Eleitoral, ficando arquivada junto aos documentos do processo eleitoral para fins de fiscalizacao, nos termos da NR-5.",
  );
  y -= 24;

  const signers = input.commission.length
    ? input.commission.map((m) => `${m.nome} — ${m.papel}`)
    : ["Presidente da Comissao Eleitoral", "Secretario da Comissao Eleitoral"];
  for (const s of signers) {
    ensureSpace(46);
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: MARGIN + 240, y },
      thickness: 0.7,
      color: rgb(0.6, 0.63, 0.62),
    });
    y -= 12;
    text(s, { size: 9, color: muted, gap: 30 });
  }

  return pdf.save();
}