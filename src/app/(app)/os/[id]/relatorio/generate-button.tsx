"use client";

import { ActionForm, SubmitButton } from "@/components/form";
import { generateReportAction } from "./actions";

export function GenerateReportButton({ orderId }: { orderId: string }) {
  return (
    <ActionForm action={generateReportAction}>
      <input type="hidden" name="order_id" value={orderId} />
      <SubmitButton className="w-full" pendingText="Gerando PDF…">
        Gerar relatório em PDF
      </SubmitButton>
    </ActionForm>
  );
}
