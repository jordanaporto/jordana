// Tarefa agendada (a cada minuto): envia lembretes/mensagens da fila do WhatsApp
// e os avisos no celular da equipe, chamando o endpoint protegido do próprio sistema.
export default async () => {
  const base = process.env.URL;
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) return new Response("não configurado", { status: 200 });
  const res = await fetch(`${base}/api/tasks/outbox`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });
  return new Response(await res.text(), { status: res.status });
};

export const config = { schedule: "* * * * *" };
