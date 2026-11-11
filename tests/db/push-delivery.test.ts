import { createECDH, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import type http from "node:http";
import https from "node:https";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import webpush from "web-push";
import { APP_URL, setupDb, type TestUser } from "./helpers";

vi.mock("server-only", () => ({}));

let db: Awaited<ReturnType<typeof setupDb>>;
let mec: TestUser;
let server: https.Server;
// serviço de push falso com certificado autoassinado (o envio real exige HTTPS)
const insecure = new https.Agent({ rejectUnauthorized: false });
const send = (sub: webpush.PushSubscription, payload: string, opts: webpush.RequestOptions) =>
  webpush.sendNotification(sub, payload, { ...opts, agent: insecure });
let received: { headers: http.IncomingHttpHeaders; body: Buffer; path: string }[] = [];
let respondWith = 201;
let base = "";

beforeAll(async () => {
  db = await setupDb();
  mec = await db.createUser("joao", "mecanico");
  const keys = webpush.generateVAPIDKeys();
  process.env.DATABASE_URL = APP_URL;
  process.env.VAPID_PUBLIC_KEY = keys.publicKey;
  process.env.VAPID_PRIVATE_KEY = keys.privateKey;
  process.env.PUSH_ALLOW_ANY_ENDPOINT = "true";
  const dir = mkdtempSync(path.join(tmpdir(), "push-"));
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-subj", "/CN=127.0.0.1", "-days", "1",
    "-keyout", path.join(dir, "k.pem"), "-out", path.join(dir, "c.pem")], { stdio: "ignore" });
  server = https.createServer({ key: readFileSync(path.join(dir, "k.pem")), cert: readFileSync(path.join(dir, "c.pem")) }, (req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      received.push({ headers: req.headers, body: Buffer.concat(chunks), path: req.url ?? "" });
      res.writeHead(respondWith).end();
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `https://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  const { pool } = await import("@/lib/db");
  await pool().end();
  server?.close();
  await db?.close();
});

function browserKeys() {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return { p256dh: ecdh.getPublicKey().toString("base64url"), auth: randomBytes(16).toString("base64url") };
}

describe("entrega dos avisos (Web Push)", () => {
  it("criptografa e envia ao serviço de push com assinatura VAPID", async () => {
    const k = browserKeys();
    await db.as(mec, (sql) => sql`select app.push_subscribe(${base + "/push/aparelho1"}, ${k.p256dh}, ${k.auth}, 'teste')`);
    await db.as(mec, (sql) => sql`select app.push_test()`);
    const { processNotifications } = await import("@/lib/push");
    const r = await processNotifications(send);
    expect(r).toMatchObject({ sent: 1, attempted: 1 });
    expect(received).toHaveLength(1);
    expect(received[0].path).toBe("/push/aparelho1");
    expect(received[0].headers["content-encoding"]).toBe("aes128gcm");
    expect(String(received[0].headers.authorization)).toMatch(/^vapid t=.+, k=/);
    expect(received[0].body.length).toBeGreaterThan(80); // conteúdo criptografado, não legível
    expect(received[0].body.toString()).not.toContain("Avisos ativados");
    const [s] = await db.owner`select last_success_at from app.push_subscriptions where endpoint like '%aparelho1'`;
    expect(s.last_success_at).not.toBeNull();
  });

  it("aparelho desinstalado (410) é removido automaticamente", async () => {
    respondWith = 410;
    received = [];
    await db.as(mec, (sql) => sql`select app.push_test()`);
    const { processNotifications } = await import("@/lib/push");
    await processNotifications(send);
    expect(received).toHaveLength(1);
    expect(await db.owner`select 1 from app.push_subscriptions where endpoint like '%aparelho1'`).toHaveLength(0);
  });

  it("só aceita endereços dos serviços oficiais de push em produção", async () => {
    const { isAllowedEndpoint } = await import("@/lib/push");
    process.env.PUSH_ALLOW_ANY_ENDPOINT = "false";
    expect(isAllowedEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(isAllowedEndpoint("https://web.push.apple.com/QGx")).toBe(true);
    expect(isAllowedEndpoint("https://updates.push.services.mozilla.com/wpush/v2/x")).toBe(true);
    expect(isAllowedEndpoint("http://fcm.googleapis.com/x")).toBe(false);
    expect(isAllowedEndpoint("https://169.254.169.254/latest")).toBe(false);
    expect(isAllowedEndpoint("https://intranet.local/push")).toBe(false);
    process.env.PUSH_ALLOW_ANY_ENDPOINT = "true";
  });
});
