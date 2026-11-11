"use client";

import { useState } from "react";
import { ActionForm, Checkbox, Field, Input, Select, SubmitButton, Textarea } from "@/components/form";
import { STATUS_META, STATUSES } from "@/lib/status";
import { brand } from "@/lib/brand";
import {
  anonymizeCustomerAction,
  saveAlertSettingsAction,
  saveCategoryAction,
  saveCompanyAction,
  saveItemAction,
  saveProviderAction,
  saveTemplateAction,
} from "./actions";

export function CategoryForm({ c }: { c?: { id: string; name: string; position: number; active: boolean } }) {
  return (
    <ActionForm action={saveCategoryAction} resetOnSuccess={!c} className="space-y-3">
      {c && <input type="hidden" name="category_id" value={c.id} />}
      <div className="grid grid-cols-[1fr_90px] gap-2">
        <Field label={c ? "Nome da categoria" : "Nova categoria"} name="name">
          <Input name="name" defaultValue={c?.name} />
        </Field>
        <Field label="Ordem" name="position">
          <Input name="position" inputMode="numeric" defaultValue={String(c?.position ?? 99)} />
        </Field>
      </div>
      {c && <Checkbox name="active" label="Ativa (aparece nas novas OS)" defaultChecked={c.active} />}
      <SubmitButton size="sm" variant="dark">
        {c ? "Salvar categoria" : "Criar categoria"}
      </SubmitButton>
    </ActionForm>
  );
}

export function ItemForm({ categoryId, item, categories }: { categoryId: string; item?: { id: string; name: string; position: number; active: boolean }; categories?: { id: string; name: string }[] }) {
  return (
    <ActionForm action={saveItemAction} resetOnSuccess={!item} className="space-y-2">
      {item && <input type="hidden" name="item_id" value={item.id} />}
      {item && categories ? (
        <Field label="Categoria" name="category_id">
          <Select name="category_id" defaultValue={categoryId}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <input type="hidden" name="category_id" value={categoryId} />
      )}
      <div className="grid grid-cols-[1fr_80px] gap-2">
        <Field label={item ? "Item" : "Novo item"} name="name">
          <Input name="name" defaultValue={item?.name} />
        </Field>
        <Field label="Ordem" name="position">
          <Input name="position" inputMode="numeric" defaultValue={String(item?.position ?? 99)} />
        </Field>
      </div>
      {item && <Checkbox name="active" label="Ativo" defaultChecked={item.active} />}
      <SubmitButton size="sm" variant={item ? "dark" : "outline"}>
        {item ? "Salvar item" : "+ Adicionar item"}
      </SubmitButton>
    </ActionForm>
  );
}

const VARS_OS = ["nome", "nome_completo", "modelo", "marca", "placa", "numero_os", "oficina"];
const VARS_AGENDA = ["nome", "nome_completo", "modelo", "marca", "placa", "servico", "data", "hora", "dia_semana", "oficina", "endereco"];
const EVENT_LABEL: Record<string, string> = {
  agendamento_confirmacao: "Ao agendar (confirmação)",
  agendamento_lembrete_1d: "1 dia antes do horário",
  agendamento_lembrete_2h: "2 horas antes do horário",
};
const SAMPLE: Record<string, string> = {
  nome: "Maria", nome_completo: "Maria Souza", modelo: "Onix", marca: "Chevrolet", placa: "QZX1A23", numero_os: "0142",
  oficina: brand.name, servico: "Revisão", data: "20/11", hora: "08:00", dia_semana: "quinta-feira",
  endereco: "Rua Exemplo, 100 – Centro",
};

export function TemplateForm({
  t,
}: {
  t?: { id: string; name: string; trigger_status: string | null; trigger_event?: string | null; body: string; meta_template_name: string | null; meta_variables: string[]; active: boolean };
}) {
  const [body, setBody] = useState(t?.body ?? "");
  const [trigger, setTrigger] = useState(t?.trigger_event ? `evento:${t.trigger_event}` : t?.trigger_status ? `status:${t.trigger_status}` : "");
  const VARS = trigger.startsWith("evento:") ? VARS_AGENDA : VARS_OS;
  const preview = Object.entries(SAMPLE).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, v), body);
  return (
    <ActionForm action={saveTemplateAction} resetOnSuccess={!t}>
      {t && <input type="hidden" name="template_id" value={t.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome" name="name">
          <Input name="name" defaultValue={t?.name} />
        </Field>
        <Field label="Quando enviar" name="trigger">
          <select
            name="trigger"
            value={trigger}
            onChange={(e) => setTrigger(e.target.value)}
            className="block w-full rounded-xl border-2 border-zinc-300 bg-white px-3 py-3 text-base outline-none focus:border-ink"
          >
            <option value="">Uso manual (sem envio automático)</option>
            <optgroup label="Quando a OS entrar na etapa">
              {STATUSES.map((s) => (
                <option key={s} value={`status:${s}`}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Agenda">
              {Object.entries(EVENT_LABEL).map(([k, l]) => (
                <option key={k} value={`evento:${k}`}>
                  {l}
                </option>
              ))}
            </optgroup>
          </select>
        </Field>
      </div>
      <Field label="Texto" name="body" hint={`Variáveis: ${VARS.map((v) => `{${v}}`).join(" ")}`}>
        <Textarea name="body" rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
      </Field>
      <div className="rounded-xl bg-green-50 p-3 text-sm">
        <div className="mb-1 text-xs font-bold uppercase text-green-900">Prévia</div>
        {preview || "—"}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome do modelo aprovado na Meta (API)" name="meta_template_name" hint="Ex.: veiculo_recebido. Vazio = envio manual.">
          <Input name="meta_template_name" defaultValue={t?.meta_template_name ?? ""} />
        </Field>
        <Field label="Variáveis do modelo Meta, em ordem" name="meta_variables" hint="Ex.: nome, modelo → {{1}}, {{2}}">
          <Input name="meta_variables" defaultValue={t?.meta_variables.join(", ") ?? ""} />
        </Field>
      </div>
      <Checkbox name="active" label="Ativo" defaultChecked={t?.active ?? true} />
      <SubmitButton size="md">{t ? "Salvar modelo" : "Criar modelo"}</SubmitButton>
    </ActionForm>
  );
}

export function AlertSettingsForm({ v }: { v: Record<string, number> }) {
  const fields: [string, string, string][] = [
    ["no_update_hours", "Veículo sem atualização há mais de", "horas"],
    ["approval_max_hours", "Orçamento aguardando aprovação há mais de", "horas"],
    ["ready_not_notified_minutes", "Pronto e cliente não avisado após", "minutos"],
    ["waiting_part_max_hours", "Parado aguardando peça há mais de", "horas"],
    ["diagnosis_max_hours", "Diagnóstico demorando mais de", "horas"],
  ];
  return (
    <ActionForm action={saveAlertSettingsAction}>
      {fields.map(([k, label, unit]) => (
        <Field key={k} label={label} name={k}>
          <div className="flex items-center gap-2">
            <Input name={k} inputMode="numeric" defaultValue={String(v[k] ?? "")} className="w-28" />
            <span className="text-zinc-600">{unit}</span>
          </div>
        </Field>
      ))}
      <SubmitButton>Salvar limites</SubmitButton>
    </ActionForm>
  );
}

export function CompanyForm({ v }: { v: Record<string, string> }) {
  return (
    <ActionForm action={saveCompanyAction}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome fantasia" name="name">
          <Input name="name" defaultValue={v.name} />
        </Field>
        <Field label="Razão social" name="legal_name">
          <Input name="legal_name" defaultValue={v.legal_name} />
        </Field>
        <Field label="CNPJ" name="cnpj">
          <Input name="cnpj" defaultValue={v.cnpj} />
        </Field>
        <Field label="Telefone" name="phone">
          <Input name="phone" defaultValue={v.phone} />
        </Field>
        <Field label="WhatsApp" name="whatsapp">
          <Input name="whatsapp" defaultValue={v.whatsapp} />
        </Field>
        <Field label="Endereço" name="address">
          <Input name="address" defaultValue={v.address} />
        </Field>
      </div>
      <SubmitButton>Salvar dados da empresa</SubmitButton>
    </ActionForm>
  );
}

export function ProviderForm({ current, configured }: { current: string; configured: boolean }) {
  return (
    <ActionForm action={saveProviderAction}>
      <Field label="Forma de envio das mensagens" name="provider">
        <Select name="provider" defaultValue={current}>
          <option value="manual">Manual oficial — atendente envia pelo link wa.me</option>
          <option value="cloud_api" disabled={!configured}>
            Automático — WhatsApp Business Platform (Cloud API){configured ? "" : " — configure as credenciais no servidor"}
          </option>
        </Select>
      </Field>
      <SubmitButton size="md" variant="dark">
        Salvar
      </SubmitButton>
    </ActionForm>
  );
}

export function AnonymizeForm({ customerId }: { customerId: string }) {
  return (
    <ActionForm action={anonymizeCustomerAction}>
      <input type="hidden" name="customer_id" value={customerId} />
      <Field label="Digite ANONIMIZAR para confirmar (não pode ser desfeito)" name="confirm">
        <Input name="confirm" autoComplete="off" />
      </Field>
      <SubmitButton size="md" variant="danger">
        Anonimizar dados pessoais
      </SubmitButton>
    </ActionForm>
  );
}
