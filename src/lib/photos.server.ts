import type { SupabaseClient } from "@supabase/supabase-js";

export const CANDIDATE_PHOTO_BUCKET = "candidate-photos";

type AnySupabase = SupabaseClient<any, any, any>;

export function isStoragePath(value?: string | null): value is string {
  return !!value && !/^https?:\/\//i.test(value);
}

/** Devolve uma URL exibível: URLs externas passam direto, caminhos do storage viram signed URL. */
export async function resolvePhotoUrl(
  sb: AnySupabase,
  fotoUrl?: string | null,
): Promise<string | null> {
  if (!fotoUrl) return null;
  if (!isStoragePath(fotoUrl)) return fotoUrl;
  const { data } = await sb.storage
    .from(CANDIDATE_PHOTO_BUCKET)
    .createSignedUrl(fotoUrl, 60 * 60);
  return data?.signedUrl ?? null;
}

export async function withPhotoUrls<T extends { foto_url?: string | null }>(
  sb: AnySupabase,
  rows: T[],
): Promise<Array<T & { foto_display_url: string | null }>> {
  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      foto_display_url: await resolvePhotoUrl(sb, row.foto_url ?? null),
    })),
  );
}

import {
  ALLOWED_PHOTO_TYPES,
  MAX_PHOTO_BYTES,
  MAX_PHOTO_LABEL,
  formatBytes,
  sniffImageType,
  validatePhotoFile,
  type AllowedPhotoType,
} from "./photo-validation";

export async function uploadCandidatePhotoFile(
  sb: AnySupabase,
  params: {
    candidateId: string;
    fileName: string;
    fileBase64: string;
    mimeType: string;
    previousPath?: string | null;
  },
): Promise<string> {
  if (!ALLOWED_PHOTO_TYPES.includes(params.mimeType as AllowedPhotoType)) {
    throw new Error("Formato não permitido. Envie uma imagem JPG, PNG ou WEBP.");
  }
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(params.fileBase64), (c) => c.charCodeAt(0));
  } catch {
    throw new Error("Não foi possível ler o arquivo enviado. Tente novamente.");
  }
  const invalid = validatePhotoFile({
    name: params.fileName,
    type: params.mimeType,
    size: bytes.byteLength,
  });
  if (invalid) throw new Error(invalid);
  if (bytes.byteLength > MAX_PHOTO_BYTES) {
    throw new Error(
      `Imagem muito grande (${formatBytes(bytes.byteLength)}). O limite é ${MAX_PHOTO_LABEL}.`,
    );
  }
  const sniffed = sniffImageType(bytes);
  if (!sniffed || sniffed !== params.mimeType) {
    throw new Error(
      "O conteúdo do arquivo não corresponde a uma imagem JPG, PNG ou WEBP válida. Envio bloqueado por segurança.",
    );
  }
  const ext = sniffed === "image/png" ? "png" : sniffed === "image/webp" ? "webp" : "jpg";
  const path = `${params.candidateId}/${Date.now()}.${ext}`;
  const { error } = await sb.storage
    .from(CANDIDATE_PHOTO_BUCKET)
    .upload(path, bytes, { contentType: sniffed, upsert: false });
  if (error) throw new Error(error.message);

  if (isStoragePath(params.previousPath)) {
    await sb.storage.from(CANDIDATE_PHOTO_BUCKET).remove([params.previousPath]);
  }
  return path;
}