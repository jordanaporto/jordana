"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, ImagePlus, LoaderCircle, RotateCcw, Video, X } from "lucide-react";
import { cx } from "./ui";

type Link = { checklist_entry_id?: string; diagnosis_id?: string; service_item_id?: string };
type Job = { id: string; name: string; status: "preparando" | "enviando" | "ok" | "erro"; progress: number; error?: string; file: File; link: Link };

const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 60;
const PHOTO_MAX_SIDE = 1600;
const THUMB_MAX_SIDE = 400;

async function canvasFrom(source: CanvasImageSource, w: number, h: number, maxSide: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext("2d")!.drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao processar imagem"))), "image/jpeg", quality),
  );
}

/** Reduz a foto no próprio celular (~1600px JPEG) e gera miniatura. */
async function preparePhoto(file: File) {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions).catch(() => null);
  if (!bmp) {
    // fallback para navegadores sem createImageBitmap com HEIC etc.
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await img.decode();
    const main = await canvasFrom(img, img.naturalWidth, img.naturalHeight, PHOTO_MAX_SIDE, 0.82);
    const thumb = await canvasFrom(img, img.naturalWidth, img.naturalHeight, THUMB_MAX_SIDE, 0.7);
    URL.revokeObjectURL(img.src);
    return { main, thumb, duration: null as number | null };
  }
  const main = await canvasFrom(bmp, bmp.width, bmp.height, PHOTO_MAX_SIDE, 0.82);
  const thumb = await canvasFrom(bmp, bmp.width, bmp.height, THUMB_MAX_SIDE, 0.7);
  bmp.close();
  return { main, thumb, duration: null as number | null };
}

/** Lê duração do vídeo e captura um quadro como miniatura. */
async function prepareVideo(file: File) {
  if (file.size > MAX_VIDEO_BYTES) throw new Error("Vídeo maior que 100 MB");
  const url = URL.createObjectURL(file);
  try {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.playsInline = true;
    v.src = url;
    await new Promise<void>((res, rej) => {
      v.onloadedmetadata = () => res();
      v.onerror = () => rej(new Error("Não foi possível ler o vídeo"));
    });
    const duration = Math.round(v.duration || 0);
    if (duration > MAX_VIDEO_SECONDS + 1) throw new Error(`Vídeo com ${duration}s — limite de ${MAX_VIDEO_SECONDS}s`);
    let thumb: Blob | null = null;
    try {
      v.currentTime = Math.min(1, (v.duration || 1) / 2);
      await new Promise<void>((res) => {
        v.onseeked = () => res();
        setTimeout(res, 2500);
      });
      if (v.videoWidth) thumb = await canvasFrom(v, v.videoWidth, v.videoHeight, THUMB_MAX_SIDE, 0.7);
    } catch {
      thumb = null;
    }
    return { main: file as Blob, thumb, duration };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function send(orderId: string, fd: FormData, onProgress: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/os/${orderId}/media`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let msg = "Falha no envio";
      try {
        msg = JSON.parse(xhr.responseText).error ?? msg;
      } catch {}
      const err = new Error(msg) as Error & { retry: boolean };
      err.retry = xhr.status >= 500 || xhr.status === 0;
      reject(err);
    };
    xhr.onerror = () => reject(Object.assign(new Error("Sem conexão"), { retry: true }));
    xhr.send(fd);
  });
}

export function MediaUploader({
  orderId,
  link = {},
  variant = "inline",
  label,
}: {
  orderId: string;
  link?: Link;
  variant?: "fab" | "inline" | "compact";
  label?: string;
}) {
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [menu, setMenu] = useState(false);
  const router = useRouter();

  const update = (id: string, patch: Partial<Job>) => setJobs((js) => js.map((j) => (j.id === id ? { ...j, ...patch } : j)));

  async function process(job: Job) {
    update(job.id, { status: "preparando", progress: 0, error: undefined });
    try {
      const isVideo = job.file.type.startsWith("video/");
      const prepared = isVideo ? await prepareVideo(job.file) : await preparePhoto(job.file);
      const fd = new FormData();
      fd.set("kind", isVideo ? "video" : "foto");
      fd.set("file", prepared.main, isVideo ? job.file.name : "foto.jpg");
      if (prepared.thumb) fd.set("thumb", prepared.thumb, "thumb.jpg");
      if (prepared.duration != null) fd.set("duration", String(prepared.duration));
      for (const [k, v] of Object.entries(job.link)) if (v) fd.set(k, v);

      // até 4 tentativas com espera crescente (sinal ruim no pátio)
      for (let attempt = 0; ; attempt++) {
        update(job.id, { status: "enviando" });
        try {
          await send(orderId, fd, (p) => update(job.id, { progress: p }));
          break;
        } catch (e) {
          const err = e as Error & { retry?: boolean };
          if (!err.retry || attempt >= 3) throw err;
          await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
        }
      }
      update(job.id, { status: "ok", progress: 100 });
      router.refresh();
      setTimeout(() => setJobs((js) => js.filter((j) => j.id !== job.id)), 2500);
    } catch (e) {
      update(job.id, { status: "erro", error: (e as Error).message });
    }
  }

  function onFiles(files: FileList | null) {
    setMenu(false);
    if (!files?.length) return;
    const newJobs: Job[] = Array.from(files).map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      status: "preparando",
      progress: 0,
      file: f,
      link,
    }));
    setJobs((js) => [...js, ...newJobs]);
    newJobs.reduce((p, j) => p.then(() => process(j)), Promise.resolve());
  }

  const inputs = (
    <>
      <input ref={photoRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
      <input ref={videoRef} type="file" accept="video/*" capture="environment" hidden onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
      <input ref={galleryRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
    </>
  );

  const queue = jobs.length > 0 && (
    <div className={cx("space-y-1", variant === "fab" && "fixed inset-x-3 bottom-40 z-30 lg:bottom-24 lg:left-auto lg:right-6 lg:w-80")}>
      {jobs.map((j) => (
        <div key={j.id} className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow">
          {j.status === "ok" ? (
            <CheckCircle2 className="size-5 text-green-700" />
          ) : j.status === "erro" ? (
            <X className="size-5 text-brand" />
          ) : (
            <LoaderCircle className="size-5 animate-spin" />
          )}
          <span className="flex-1 truncate">
            {j.status === "preparando" && "Preparando…"}
            {j.status === "enviando" && `Enviando ${j.progress}%`}
            {j.status === "ok" && "Enviado"}
            {j.status === "erro" && (j.error ?? "Erro")}
          </span>
          {j.status === "erro" && (
            <button onClick={() => process(j)} className="inline-flex items-center gap-1 font-semibold text-brand">
              <RotateCcw className="size-4" /> Tentar de novo
            </button>
          )}
        </div>
      ))}
    </div>
  );

  if (variant === "fab") {
    return (
      <>
        {inputs}
        {queue}
        <div className="no-print fixed bottom-36 right-4 z-30 flex flex-col items-end gap-2 lg:bottom-24 lg:right-8">
          {menu && (
            <>
              <button onClick={() => galleryRef.current?.click()} className="flex h-12 items-center gap-2 rounded-full bg-white px-4 font-semibold shadow-lg">
                <ImagePlus className="size-5" /> Galeria
              </button>
              <button onClick={() => videoRef.current?.click()} className="flex h-12 items-center gap-2 rounded-full bg-white px-4 font-semibold shadow-lg">
                <Video className="size-5" /> Gravar vídeo
              </button>
            </>
          )}
          <button
            onClick={() => setMenu((m) => !m)}
            aria-label="Mais opções de mídia"
            className="flex size-10 items-center justify-center rounded-full bg-white text-lg font-bold shadow-lg"
          >
            {menu ? "×" : "…"}
          </button>
          <button
            onClick={() => photoRef.current?.click()}
            aria-label="Tirar foto"
            className="flex size-16 items-center justify-center rounded-full bg-ink text-white shadow-xl ring-4 ring-white active:scale-95"
          >
            <Camera className="size-8" />
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="space-y-2">
      {inputs}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => photoRef.current?.click()}
          className={cx(
            "inline-flex items-center gap-2 rounded-xl border-2 border-zinc-300 bg-white font-semibold",
            variant === "compact" ? "h-11 px-3 text-sm" : "tap px-4",
          )}
        >
          <Camera className="size-5" /> {label ?? "Foto"}
        </button>
        <button
          type="button"
          onClick={() => videoRef.current?.click()}
          className={cx(
            "inline-flex items-center gap-2 rounded-xl border-2 border-zinc-300 bg-white font-semibold",
            variant === "compact" ? "h-11 px-3 text-sm" : "tap px-4",
          )}
        >
          <Video className="size-5" /> Vídeo
        </button>
        {variant !== "compact" && (
          <button type="button" onClick={() => galleryRef.current?.click()} className="tap inline-flex items-center gap-2 rounded-xl border-2 border-zinc-300 bg-white px-4 font-semibold">
            <ImagePlus className="size-5" /> Galeria
          </button>
        )}
      </div>
      {queue}
    </div>
  );
}
