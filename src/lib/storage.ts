import "server-only";
import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "./env";

/**
 * Armazenamento privado de mídia/relatórios. Nada é público: a aplicação lê o
 * arquivo e o entrega somente depois de checar sessão e permissão no banco.
 *   local → pasta no servidor (STORAGE_LOCAL_DIR)
 *   s3    → qualquer serviço compatível (AWS S3, Cloudflare R2, Supabase Storage, MinIO)
 */
export type StoredObject = {
  body: ReadableStream<Uint8Array>;
  size: number;
  contentLength: number;
  range?: { start: number; end: number };
};

export interface Storage {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string, range?: { start: number; end?: number }): Promise<StoredObject | null>;
  getBuffer(key: string): Promise<Buffer | null>;
  remove(key: string): Promise<void>;
}

function safeKey(key: string) {
  if (!/^[a-z0-9/_.-]+$/i.test(key) || key.includes("..")) throw new Error("chave de arquivo inválida");
  return key;
}

class LocalStorage implements Storage {
  constructor(private root: string) {}
  private file(key: string) {
    return path.join(path.resolve(this.root), safeKey(key));
  }
  async put(key: string, data: Buffer) {
    const f = this.file(key);
    await mkdir(path.dirname(f), { recursive: true, mode: 0o700 });
    await writeFile(f, data, { mode: 0o600 });
  }
  async get(key: string, range?: { start: number; end?: number }) {
    const f = this.file(key);
    const st = await stat(f).catch(() => null);
    if (!st) return null;
    const start = range ? Math.min(range.start, st.size - 1) : 0;
    const end = range ? Math.min(range.end ?? st.size - 1, st.size - 1) : st.size - 1;
    const stream = createReadStream(f, { start, end });
    return {
      body: Readable.toWeb(stream) as ReadableStream<Uint8Array>,
      size: st.size,
      contentLength: end - start + 1,
      range: range ? { start, end } : undefined,
    };
  }
  async getBuffer(key: string) {
    const { readFile } = await import("node:fs/promises");
    return readFile(this.file(key)).catch(() => null);
  }
  async remove(key: string) {
    await rm(this.file(key), { force: true });
  }
}

class S3Storage implements Storage {
  private client = new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    },
  });
  private bucket = process.env.S3_BUCKET ?? "";
  async put(key: string, data: Buffer, contentType: string) {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: safeKey(key), Body: data, ContentType: contentType, ServerSideEncryption: process.env.S3_SSE === "false" ? undefined : "AES256" }),
    );
  }
  async get(key: string, range?: { start: number; end?: number }) {
    try {
      const r = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: safeKey(key),
          Range: range ? `bytes=${range.start}-${range.end ?? ""}` : undefined,
        }),
      );
      const contentLength = Number(r.ContentLength ?? 0);
      let size = contentLength;
      let rg: { start: number; end: number } | undefined;
      const m = r.ContentRange?.match(/bytes (\d+)-(\d+)\/(\d+)/);
      if (m) {
        rg = { start: Number(m[1]), end: Number(m[2]) };
        size = Number(m[3]);
      }
      return { body: r.Body!.transformToWebStream() as ReadableStream<Uint8Array>, size, contentLength, range: rg };
    } catch (e) {
      if ((e as { name?: string }).name === "NoSuchKey") return null;
      throw e;
    }
  }
  async getBuffer(key: string) {
    const o = await this.get(key);
    if (!o) return null;
    return Buffer.from(await new Response(o.body).arrayBuffer());
  }
  async remove(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: safeKey(key) }));
  }
}

let instance: Storage | null = null;
export function storage(): Storage {
  if (!instance) instance = env.storageDriver === "s3" ? new S3Storage() : new LocalStorage(env.storageLocalDir);
  return instance;
}

/** Confere o tipo real do arquivo pelos primeiros bytes (não confia na extensão). */
export function sniffMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buf.toString("ascii", 4, 8) === "ftyp") {
    const brand = buf.toString("ascii", 8, 12);
    return brand.startsWith("qt") ? "video/quicktime" : "video/mp4";
  }
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return "video/webm";
  return null;
}

export const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};
