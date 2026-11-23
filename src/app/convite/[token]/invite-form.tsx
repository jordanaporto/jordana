"use client";

import { ActionForm, Field, Input, SubmitButton } from "@/components/form";
import { acceptInviteAction } from "./actions";

export function InviteForm({ token }: { token: string }) {
  return (
    <ActionForm action={acceptInviteAction}>
      <input type="hidden" name="token" value={token} />
      <Field label="Crie sua senha" name="password" hint="Pelo menos 8 caracteres, com letras e números">
        <Input name="password" type="password" autoComplete="new-password" />
      </Field>
      <Field label="Repita a senha" name="confirm">
        <Input name="confirm" type="password" autoComplete="new-password" />
      </Field>
      <SubmitButton className="w-full">Salvar senha e entrar</SubmitButton>
    </ActionForm>
  );
}
