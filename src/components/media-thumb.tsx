import { Play } from "lucide-react";

/** Miniatura protegida: a imagem passa por /api/media, que confere a sessão e a permissão. */
export function MediaThumb({ id, kind, caption }: { id: string; kind: string; caption?: string | null }) {
  return (
    <a
      href={`/api/media/${id}`}
      target="_blank"
      rel="noopener"
      className="relative block aspect-square overflow-hidden rounded-lg bg-zinc-200"
      title={caption ?? undefined}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/media/${id}?thumb=1`} alt={caption ?? "Foto do atendimento"} loading="lazy" className="size-full object-cover" />
      {kind === "video" && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/30">
          <Play className="size-8 fill-white text-white" aria-hidden />
        </span>
      )}
    </a>
  );
}
