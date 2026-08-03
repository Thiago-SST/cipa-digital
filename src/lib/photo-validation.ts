/** Regras compartilhadas (cliente + servidor) para upload de foto de candidato. */

export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
export const MAX_PHOTO_LABEL = "3 MB";
export const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const ALLOWED_PHOTO_EXTENSIONS = ["jpg", "jpeg", "png", "webp"] as const;
export const PHOTO_ACCEPT_ATTR = ALLOWED_PHOTO_TYPES.join(",");
export const PHOTO_RULES_HINT = `JPG, PNG ou WEBP, até ${MAX_PHOTO_LABEL}.`;

export type AllowedPhotoType = (typeof ALLOWED_PHOTO_TYPES)[number];

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function extensionOf(fileName: string): string {
  const i = fileName.lastIndexOf(".");
  return i >= 0 ? fileName.slice(i + 1).toLowerCase() : "";
}

/** Valida tipo, extensão e tamanho. Devolve mensagem de erro ou null quando válido. */
export function validatePhotoFile(input: {
  name: string;
  type: string;
  size: number;
}): string | null {
  const type = (input.type || "").toLowerCase();
  if (!ALLOWED_PHOTO_TYPES.includes(type as AllowedPhotoType)) {
    return `Formato não permitido${type ? ` (${type})` : ""}. Envie uma imagem JPG, PNG ou WEBP. Arquivos como PDF, SVG, GIF ou executáveis são bloqueados por segurança.`;
  }
  const ext = extensionOf(input.name);
  if (ext && !ALLOWED_PHOTO_EXTENSIONS.includes(ext as (typeof ALLOWED_PHOTO_EXTENSIONS)[number])) {
    return `A extensão ".${ext}" não é permitida. Use .jpg, .png ou .webp.`;
  }
  if (input.size <= 0) return "Arquivo vazio ou ilegível. Selecione outra imagem.";
  if (input.size > MAX_PHOTO_BYTES) {
    return `Imagem muito grande (${formatBytes(input.size)}). O limite é ${MAX_PHOTO_LABEL}.`;
  }
  return null;
}

/** Confere a assinatura binária do arquivo (impede renomear um .exe/.svg para .jpg). */
export function sniffImageType(bytes: Uint8Array): AllowedPhotoType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && png.every((b, i) => bytes[i] === b)) return "image/png";
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}
