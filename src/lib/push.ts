import "server-only";
import webpush from "web-push";
import { brand } from "./brand";
import { asSystem } from "./db";

/**
 * Avisos no celular da equipe (Web Push, padrão aberto dos navegadores).
 * Chaves VAPID geradas uma vez: npm run push:keys
 */
export function pushConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY ?? "";
  const privateKey = process.env.VAPID_PRIVATE_KEY ?? "";
  const subject = process.env.VAPID_SUBJECT || "mailto:suporte@example.com";
  return { publicKey, privateKey, subject, configured: Boolean(publicKey && privateKey) };
}

// Serviços de push dos navegadores (Chrome/Android, Firefox, Safari/iPhone, Edge).
// O servidor só envia para esses endereços — evita que alguém use o cadastro para acessar a rede interna.
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/];

export function isAllowedEndpoint(endpoint: string): boolean {
  try {
    const u = new URL(endpoint);
    if (process.env.PUSH_ALLOW_ANY_ENDPOINT === "true" && process.env.NODE_ENV !== "production") return true;
    return u.protocol === "https:" && PUSH_HOSTS.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}

type Row = { notification_id: number; subscription_id: string; endpoint: string; p256dh: string; auth: string; title: string; body: string | null; url: string | null };
type Sender = (sub: webpush.PushSubscription, payload: string, opts: webpush.RequestOptions) => Promise<{ statusCode: number }>;

/** Gera avisos de alertas novos e envia todos os avisos pendentes. */
export async function processNotifications(send: Sender = webpush.sendNotification) {
  const cfg = pushConfig();
  if (!cfg.configured) return { sent: 0, skipped: "VAPID não configurado" };
  await asSystem((sql) => sql`select app.collect_alert_notifications()`);
  const rows = (await asSystem((sql) => sql`select * from app.notifications_claim(100)`)) as unknown as Row[];
  let sent = 0;
  for (const r of rows) {
    let ok = false;
    let gone = false;
    if (!isAllowedEndpoint(r.endpoint)) {
      gone = true;
    } else {
      try {
        await send(
          { endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } },
          JSON.stringify({ title: r.title, body: r.body ?? "", url: r.url ?? "/", tag: `n${r.notification_id}`, icon: brand.icon192 }),
          { vapidDetails: { subject: cfg.subject, publicKey: cfg.publicKey, privateKey: cfg.privateKey }, TTL: 6 * 3600, urgency: "high" },
        );
        ok = true;
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        gone = code === 404 || code === 410;
      }
    }
    await asSystem((sql) => sql`select app.push_result(${r.subscription_id}, ${ok}, ${gone})`);
  }
  return { sent, attempted: rows.length };
}
