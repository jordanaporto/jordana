"use client";

import { ActionForm, Checkbox, Field, Input, Select, SubmitButton } from "@/components/form";
import { ROLE_LABEL, ROLES } from "@/lib/roles";
import { createUserAction, resetPasswordAction, updateUserAction } from "./actions";
import { InviteControls, InviteLinkBox } from "./invite";

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
      {(state) => (
        <>
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
            <Field label="WhatsApp (para enviar o convite)" name="phone">
              <Input name="phone" inputMode="tel" placeholder="(91) 9 8888-7777" />
            </Field>
          </div>
          <details className="rounded-xl border border-zinc-200 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-zinc-700">Prefiro definir uma senha provisória</summary>
            <div className="mt-3">
              <Field label="Senha provisória" name="password" hint="Deixe em branco para gerar o link de convite. Com senha provisória, a pessoa troca no primeiro acesso.">
                <Input name="password" type="text" autoComplete="off" />
              </Field>
            </div>
          </details>
          <SubmitButton className="w-full sm:w-auto">Criar usuário e gerar convite</SubmitButton>
          {state.ok && state.data?.inviteUrl && (
            <InviteLinkBox
              url={state.data.inviteUrl}
              expiresAt={state.data.expiresAt}
              name={state.data.name}
              username={state.data.username}
              phone={state.data.phone}
            />
          )}
        </>
      )}
    </ActionForm>
  );
}

export function EditUserForm({
  user,
  isSelf,
  inviteUntil = null,
}: {
  user: { id: string; full_name: string; username: string; role: string; phone: string; active: boolean };
  isSelf: boolean;
  inviteUntil?: string | null;
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
      {!isSelf && user.active && <InviteControls user={user} pendingUntil={inviteUntil} />}
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
