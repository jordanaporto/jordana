import { processOutbox } from "./lib/whatsapp";

export function startWorker() {
  if (process.env.ENABLE_BACKGROUND_WORKER !== "true") return;
  const g = globalThis as unknown as { __injecarWorker?: NodeJS.Timeout };
  if (g.__injecarWorker) return;
  let running = false;
  g.__injecarWorker = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await processOutbox(20);
    } catch (e) {
      console.error("[fila whatsapp]", (e as Error).message);
    } finally {
      running = false;
    }
  }, 60_000);
}
