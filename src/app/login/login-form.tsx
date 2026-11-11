"use client";

import { ActionForm, Field, Input, SubmitButton } from "@/components/form";
import { loginAction } from "./actions";

export function LoginForm() {
  return (
    <ActionForm action={loginAction}>
      <Field label="Usuário" name="username">
        <Input
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="ex.: joao"
          required
        />
      </Field>
      <Field label="Senha" name="password">
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      <SubmitButton className="w-full" pendingText="Entrando…">
        Entrar
      </SubmitButton>
    </ActionForm>
  );
}
