import { processNotifications } from "./lib/push";
import { processOutbox } from "./lib/whatsapp";

/** Tarefas de fundo: avisos no celular (30 s) e fila do WhatsApp/lembretes (60 s). */
export function startWorker() {
  if (process.env.ENABLE_BACKGROUND_WORKER !== "true") return;
  const g = globalThis as unknown as { __injecarWorker?: NodeJS.Timeout };
  if (g.__injecarWorker) return;
  let running = false;
  let tick = 0;
  g.__injecarWorker = setInterval(async () => {
    if (running) return;
    running = true;
    tick++;
    try {
      await processNotifications();
      if (tick % 2 === 0) await processOutbox(20);
    } catch (e) {
      console.error("[tarefas]", (e as Error).message);
    } finally {
      running = false;
    }
  }, 30_000);
}
