"use client";

import { ActionForm, Checkbox, Field, Input, Select, SubmitButton } from "@/components/form";
import { ROLE_LABEL, ROLES } from "@/lib/roles";
import { createUserAction, resetPasswordAction, updateUserAction } from "./actions";

function RoleOptions() {
  return (
    <>
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {ROLE_LABEL[r]}
        </option>
      ))}
    </>
  );
}

export function CreateUserForm() {
  return (
    <ActionForm action={createUserAction} resetOnSuccess>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome completo" name="full_name">
          <Input name="full_name" />
        </Field>
        <Field label="Usuário (login)" name="username" hint="ex.: joao, ana.silva">
          <Input name="username" autoCapitalize="none" autoCorrect="off" />
        </Field>
        <Field label="Perfil" name="role">
          <Select name="role" defaultValue="mecanico">
            <RoleOptions />
          </Select>
        </Field>
        <Field label="Telefone (opcional)" name="phone">
          <Input name="phone" inputMode="tel" />
        </Field>
        <Field label="Senha provisória" name="password" hint="O usuário troca no primeiro acesso" className="sm:col-span-2">
          <Input name="password" type="text" autoComplete="off" />
        </Field>
      </div>
      <SubmitButton className="w-full sm:w-auto">Criar usuário</SubmitButton>
    </ActionForm>
  );
}

export function EditUserForm({
  user,
  isSelf,
}: {
  user: { id: string; full_name: string; role: string; phone: string; active: boolean };
  isSelf: boolean;
}) {
  return (
    <div className="space-y-6">
      <ActionForm action={updateUserAction}>
        <input type="hidden" name="user_id" value={user.id} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome completo" name="full_name">
            <Input name="full_name" defaultValue={user.full_name} />
          </Field>
          <Field label="Perfil" name="role">
            <Select name="role" defaultValue={user.role} disabled={isSelf}>
              <RoleOptions />
            </Select>
            {isSelf && <input type="hidden" name="role" value={user.role} />}
          </Field>
          <Field label="Telefone" name="phone">
            <Input name="phone" defaultValue={user.phone} />
          </Field>
        </div>
        {isSelf ? (
          <input type="hidden" name="active" value="on" />
        ) : (
          <Checkbox name="active" label="Usuário ativo" defaultChecked={user.active} hint="Desmarque para bloquear o acesso imediatamente" />
        )}
        <SubmitButton size="md">Salvar alterações</SubmitButton>
      </ActionForm>
      {!isSelf && (
        <ActionForm action={resetPasswordAction} resetOnSuccess>
          <input type="hidden" name="user_id" value={user.id} />
          <Field label="Definir nova senha provisória" name="password">
            <Input name="password" type="text" autoComplete="off" />
          </Field>
          <SubmitButton size="md" variant="outline">
            Redefinir senha
          </SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}
