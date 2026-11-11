"use client";

import { useState } from "react";
import { ActionForm, Field, Input, Select, SubmitButton, Textarea } from "@/components/form";
import { openOrderAction } from "../actions";

export function OpenOrderForm({
  customerId,
  vehicleId,
  currentKm,
  mechanics,
}: {
  customerId: string;
  vehicleId: string;
  currentKm: number | null;
  mechanics: { id: string; name: string }[];
}) {
  const [kmValue, setKm] = useState("");
  const typed = Number(kmValue.replace(/\D/g, ""));
  const lower = kmValue && currentKm != null && typed < currentKm;
  return (
    <ActionForm action={openOrderAction}>
      <input type="hidden" name="customer_id" value={customerId} />
      <input type="hidden" name="vehicle_id" value={vehicleId} />
      <Field
        label="Quilometragem de entrada"
        name="entry_km"
        hint={lower ? "⚠ Menor que a última registrada — confira o painel" : "Leia no painel do carro"}
      >
        <Input
          name="entry_km"
          inputMode="numeric"
          className="text-2xl font-bold tabular-nums"
          value={kmValue}
          onChange={(e) => setKm(e.target.value.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, "."))}
        />
      </Field>
      <Field label="O que o cliente relatou?" name="complaint">
        <Textarea name="complaint" rows={4} placeholder="Ex.: barulho na suspensão dianteira ao passar em lombadas" />
      </Field>
      <Field label="Observações do atendimento" name="intake_notes">
        <Textarea name="intake_notes" placeholder="Objetos no carro, avarias visíveis, combinados com o cliente…" />
      </Field>
      <Field label="Mecânico responsável" name="mechanic_id">
        <Select name="mechanic_id" defaultValue="">
          <option value="">Definir depois</option>
          {mechanics.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
      </Field>
      <p className="text-sm text-zinc-600">Data e horário de entrada são registrados automaticamente.</p>
      <SubmitButton className="w-full" pendingText="Abrindo OS…">
        Abrir ordem de serviço
      </SubmitButton>
    </ActionForm>
  );
}
