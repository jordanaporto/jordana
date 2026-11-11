/**
 * Ao iniciar o servidor (Node): se ENABLE_BACKGROUND_WORKER=true, processa a fila
 * de mensagens do WhatsApp (Cloud API) a cada minuto, sem precisar de cron externo.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startWorker } = await import("./worker");
    startWorker();
  }
}
