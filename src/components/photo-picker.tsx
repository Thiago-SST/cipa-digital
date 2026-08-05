import { useEffect, useRef, useState } from "react";
import { AlertCircle, Upload, X } from "lucide-react";

import {
  PHOTO_ACCEPT_ATTR,
  PHOTO_RULES_HINT,
  formatBytes,
  validatePhotoFile,
} from "@/lib/photo-validation";

type Selected = { file: File; previewUrl: string };

/**
 * Seletor de foto com validação (formato/tamanho) e pré-visualização antes de salvar.
 * A imagem só é enviada ao servidor após a confirmação do usuário.
 */
export function PhotoPicker({
  currentUrl,
  nome,
  size = 56,
  busy,
  serverError,
  triggerLabel,
  onConfirm,
  onRemove,
}: {
  currentUrl: string | null;
  nome: string;
  size?: number;
  busy: boolean;
  serverError?: string | null;
  triggerLabel?: string;
  onConfirm: (file: File) => void;
  onRemove?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (selected) URL.revokeObjectURL(selected.previewUrl);
    };
  }, [selected]);

  function clearSelection() {
    setSelected((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  }

  async function handleFile(file: File) {
    const message = validatePhotoFile({ name: file.name, type: file.type, size: file.size });
    if (message) {
      clearSelection();
      setError(message);
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    // Confirma que o arquivo é realmente uma imagem decodificável (extensão não basta).
    const decodable = await new Promise<boolean>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = previewUrl;
    });
    if (!decodable) {
      URL.revokeObjectURL(previewUrl);
      clearSelection();
      setError("Arquivo inválido: não é uma imagem JPG, PNG ou WEBP legítima.");
      return;
    }
    setError(null);
    setSelected((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return { file, previewUrl };
    });
  }

  const box = { width: size, height: size };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {currentUrl ? (
          <img
            src={currentUrl}
            alt={`Foto de ${nome}`}
            style={box}
            className="rounded-full object-cover"
          />
        ) : (
          <span
            style={box}
            className="grid place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
          >
            {nome.slice(0, 2).toUpperCase()}
          </span>
        )}
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-60"
          >
            <Upload className="h-3 w-3" />
            {busy ? "Enviando..." : triggerLabel ?? (currentUrl ? "Trocar foto" : "Enviar foto")}
          </button>
          {currentUrl && !busy && onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="text-xs text-destructive hover:underline"
            >
              Remover
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={PHOTO_ACCEPT_ATTR}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) handleFile(file);
          }}
        />
      </div>

      <p className="text-[11px] text-muted-foreground">{PHOTO_RULES_HINT}</p>

      {error && (
        <p className="flex items-start gap-1 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
      {serverError && !error && (
        <p className="flex items-start gap-1 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{serverError}</span>
        </p>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4">
          <div className="w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-lg">
            <div className="flex items-start justify-between">
              <h3 className="text-sm font-semibold text-foreground">Pré-visualizar foto</h3>
              <button
                type="button"
                onClick={clearSelection}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 flex flex-col items-center gap-3">
              <img
                src={selected.previewUrl}
                alt="Pré-visualização da foto selecionada"
                className="h-40 w-40 rounded-full border border-border object-cover"
              />
              <p className="text-center text-xs text-muted-foreground">
                {selected.file.name} · {formatBytes(selected.file.size)}
              </p>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={clearSelection}
                className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  onConfirm(selected.file);
                  clearSelection();
                }}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                Salvar foto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
