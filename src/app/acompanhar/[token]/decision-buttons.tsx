"use client";

import { useState, useTransition } from "react";
import { cx } from "@/components/ui";
import { decideByLink } from "../actions";

const EXEC: Record<string, string> = {
  em_execucao: "Em execução",
  executado: "Concluído",
  nao_executado: "Não realizado",
};

export function DecisionButtons({
  token,
  itemId,
  decisao,
  execucao,
  canDecide,
}: {
  token: string;
  itemId: string;
  decisao: "pendente" | "aprovado" | "recusado";
  execucao: string;
  canDecide: boolean;
}) {
  const [pending, start] = useTransition();
  const [current, setCurrent] = useState(decisao);
  const [error, setError] = useState<string | null>(null);

  const decide = (d: "aprovado" | "recusado") =>
    start(async () => {
      setError(null);
      const r = await decideByLink({ token, itemId, decision: d });
      if (r.ok) setCurrent(d);
      else setError(r.error ?? "Não foi possível registrar");
    });

  if (!canDecide) {
    return (
      <div className="mt-2 text-sm font-semibold">
        {current === "aprovado" && <span className="text-green-700">✓ Aprovado{EXEC[execucao] ? ` · ${EXEC[execucao]}` : ""}</span>}
        {current === "recusado" && <span className="text-zinc-500">Não aprovado</span>}
        {current === "pendente" && <span className="text-zinc-500">Aguardando decisão</span>}
      </div>
    );
  }

  return (
    <div className="mt-3">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => decide("aprovado")}
          className={cx(
            "tap rounded-xl border-2 font-bold disabled:opacity-60",
            current === "aprovado" ? "border-green-700 bg-green-700 text-white" : "border-green-700 text-green-800",
          )}
        >
          {current === "aprovado" ? "✓ Aprovado" : "Aprovar"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => decide("recusado")}
          className={cx(
            "tap rounded-xl border-2 font-bold disabled:opacity-60",
            current === "recusado" ? "border-zinc-700 bg-zinc-700 text-white" : "border-zinc-300 text-zinc-700",
          )}
        >
          {current === "recusado" ? "Recusado" : "Recusar"}
        </button>
      </div>
      {error && <p className="mt-1 text-sm font-semibold text-brand">{error}</p>}
    </div>
  );
}
