"use client";

import { ActionForm, Field, Input, SubmitButton } from "@/components/form";
import { changePasswordAction } from "./actions";

export function PasswordForm() {
  return (
    <ActionForm action={changePasswordAction} resetOnSuccess>
      <Field label="Senha atual" name="current">
        <Input name="current" type="password" autoComplete="current-password" />
      </Field>
      <Field label="Nova senha" name="password" hint="Mínimo de 8 caracteres, com letras e números">
        <Input name="password" type="password" autoComplete="new-password" />
      </Field>
      <Field label="Repita a nova senha" name="confirm">
        <Input name="confirm" type="password" autoComplete="new-password" />
      </Field>
      <SubmitButton className="w-full">Salvar nova senha</SubmitButton>
    </ActionForm>
  );
}
