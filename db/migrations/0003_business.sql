-- =====================================================================
-- Regras de negócio (funções transacionais)
-- Todas são SECURITY DEFINER e validam o perfil do usuário da sessão.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Configurações
-- ---------------------------------------------------------------------
create or replace function app.setting(p_key text, p_default jsonb default null) returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$ select coalesce((select value from settings where key = p_key), p_default) $$;

-- ---------------------------------------------------------------------
-- Mensagens: renderização e enfileiramento
-- ---------------------------------------------------------------------
create or replace function app.message_variables(p_order uuid) returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
           'nome', split_part(trim(c.name), ' ', 1),
           'nome_completo', c.name,
           'modelo', v.model,
           'marca', v.brand,
           'placa', v.plate,
           'numero_os', lpad(so.number::text, 4, '0'),
           'oficina', coalesce(app.setting('company') ->> 'name', 'Injecar Auto Center'))
    from service_orders so
    join customers c on c.id = so.customer_id
    join vehicles v on v.id = so.vehicle_id
   where so.id = p_order
$$;

create or replace function app.render_message(p_body text, p_vars jsonb) returns text
language plpgsql immutable
as $$
declare k text; out text := p_body;
begin
  for k in select jsonb_object_keys(p_vars) loop
    out := replace(out, '{' || k || '}', coalesce(p_vars ->> k, ''));
  end loop;
  return out;
end $$;

-- Enfileira a mensagem do modelo informado. Respeita consentimento e cliente anonimizado.
create or replace function app.enqueue_template_message(p_order uuid, p_template uuid) returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  t message_templates;
  c customers;
  vars jsonb;
  prov message_provider;
  new_id uuid;
begin
  select * into t from message_templates where id = p_template and active;
  if not found then return null; end if;

  select c2.* into c from customers c2 join service_orders so on so.customer_id = c2.id where so.id = p_order;
  if not found or not c.whatsapp_opt_in or c.anonymized_at is not null
     or coalesce(c.whatsapp, c.phone) is null then
    return null;
  end if;

  vars := app.message_variables(p_order);
  prov := coalesce(app.setting('messaging.provider') #>> '{}', 'manual')::message_provider;
  if prov = 'cloud_api' and t.meta_template_name is null then
    prov := 'manual';  -- sem modelo aprovado na Meta: envio manual
  end if;

  insert into outbound_messages (service_order_id, customer_id, template_id, trigger_status, to_phone,
                                 rendered_body, variables, provider)
  values (p_order, c.id, t.id, t.trigger_status, coalesce(c.whatsapp, c.phone),
          app.render_message(t.body, vars), vars, prov)
  returning id into new_id;
  return new_id;
end $$;

create or replace function app.enqueue_status_message(p_order uuid, p_status os_status) returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare tid uuid;
begin
  select id into tid from message_templates where trigger_status = p_status and active;
  if tid is null then return null; end if;
  return app.enqueue_template_message(p_order, tid);
end $$;

-- ---------------------------------------------------------------------
-- Abertura da OS
-- ---------------------------------------------------------------------
create or replace function app.open_service_order(
  p_customer uuid, p_vehicle uuid, p_entry_km integer, p_mechanic uuid,
  p_complaint text, p_intake_notes text
) returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v vehicles;
  new_id uuid;
begin
  perform app.require_role('atendimento', 'admin');

  select * into v from vehicles where id = p_vehicle for update;
  if not found then raise exception 'Veículo não encontrado'; end if;
  if v.customer_id <> p_customer then
    raise exception 'O veículo não pertence a este cliente';
  end if;
  if exists (select 1 from customers where id = p_customer and anonymized_at is not null) then
    raise exception 'Cliente anonimizado não pode abrir nova OS';
  end if;
  if exists (select 1 from service_orders where vehicle_id = p_vehicle and status not in ('entregue', 'cancelada')) then
    raise exception 'Este veículo já possui uma OS aberta';
  end if;
  if p_mechanic is not null and not exists (
       select 1 from profiles where id = p_mechanic and role = 'mecanico' and active) then
    raise exception 'Mecânico inválido ou inativo';
  end if;

  insert into service_orders (vehicle_id, customer_id, entry_km, assigned_mechanic_id, complaint, intake_notes)
  values (p_vehicle, p_customer, p_entry_km, p_mechanic, trim(p_complaint), nullif(trim(p_intake_notes), ''))
  returning id into new_id;

  update vehicles set current_km = greatest(coalesce(current_km, 0), p_entry_km) where id = p_vehicle;

  insert into service_order_checklist (service_order_id, checklist_item_id, category_name, category_position,
                                       item_name, position)
  select new_id, i.id, c.name, c.position, i.name, i.position
    from checklist_items i
    join checklist_categories c on c.id = i.category_id
   where i.active and c.active;

  insert into service_order_status_history (service_order_id, from_status, to_status, note)
  values (new_id, null, 'recebido', null);

  perform app.enqueue_status_message(new_id, 'recebido');
  return new_id;
end $$;

create or replace function app.update_service_order(
  p_order uuid, p_entry_km integer, p_complaint text, p_intake_notes text, p_final_notes text
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare r user_role := app.require_role('atendimento', 'admin');
begin
  if not app.can_edit_order(p_order) then
    raise exception 'OS encerrada não pode ser alterada' using errcode = '42501';
  end if;
  update service_orders
     set entry_km = coalesce(p_entry_km, entry_km),
         complaint = coalesce(nullif(trim(p_complaint), ''), complaint),
         intake_notes = nullif(trim(p_intake_notes), ''),
         final_notes = nullif(trim(p_final_notes), '')
   where id = p_order;
end $$;

create or replace function app.assign_mechanic(p_order uuid, p_mechanic uuid) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  old_mech uuid;
  mech_name text;
begin
  perform app.require_role('atendimento', 'admin');
  if not app.can_edit_order(p_order) then
    raise exception 'OS encerrada não pode ser alterada' using errcode = '42501';
  end if;
  if p_mechanic is not null and not exists (
       select 1 from profiles where id = p_mechanic and role = 'mecanico' and active) then
    raise exception 'Mecânico inválido ou inativo';
  end if;
  select assigned_mechanic_id into old_mech from service_orders where id = p_order for update;
  if old_mech is not distinct from p_mechanic then return; end if;

  update service_orders set assigned_mechanic_id = p_mechanic where id = p_order;
  select full_name into mech_name from profiles where id = p_mechanic;
  insert into service_order_notes (service_order_id, body, is_system)
  values (p_order, coalesce('Mecânico responsável: ' || mech_name, 'Mecânico responsável removido'), true);
end $$;

-- ---------------------------------------------------------------------
-- Status: máquina de estados
-- ---------------------------------------------------------------------
create or replace function app.status_next(p_from os_status) returns os_status[]
language sql immutable
as $$
  select case p_from
    when 'recebido'                then array['em_inspecao', 'em_diagnostico']
    when 'em_inspecao'             then array['em_diagnostico']
    when 'em_diagnostico'          then array['diagnostico_concluido']
    when 'diagnostico_concluido'   then array['orcamento_em_preparacao']
    when 'orcamento_em_preparacao' then array['aguardando_aprovacao']
    when 'aguardando_aprovacao'    then array['servico_aprovado', 'pronto_retirada']
    when 'servico_aprovado'        then array['em_manutencao']
    when 'em_manutencao'           then array['em_teste', 'aguardando_peca', 'servico_concluido']
    when 'aguardando_peca'         then array['em_manutencao']
    when 'em_teste'                then array['servico_concluido', 'em_manutencao']
    when 'servico_concluido'       then array['pronto_retirada']
    when 'pronto_retirada'         then array['entregue']
    when 'cancelada'               then array['entregue']
    else array[]::text[]
  end::os_status[]
$$;

-- Quem pode levar a OS para cada etapa (avanço normal)
create or replace function app.status_roles(p_to os_status) returns user_role[]
language sql immutable
as $$
  select case
    when p_to in ('em_inspecao', 'em_diagnostico', 'diagnostico_concluido', 'em_teste', 'servico_concluido')
      then array['mecanico', 'admin']
    when p_to in ('em_manutencao', 'aguardando_peca')
      then array['mecanico', 'atendimento', 'admin']
    else array['atendimento', 'admin']
  end::user_role[]
$$;

create or replace function app.status_rank(p_status os_status) returns integer
language sql immutable
as $$ select array_position(enum_range(null::os_status), p_status) $$;

-- Lista de etapas que o usuário atual pode escolher agora (para a tela)
create or replace function app.available_transitions(p_order uuid)
returns table (to_status os_status, kind text)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  so service_orders;
  r user_role := app.role();
  s os_status;
begin
  select * into so from service_orders where id = p_order;
  if not found or r is null or not app.can_view_order(p_order) then return; end if;
  if r = 'mecanico' and so.assigned_mechanic_id is distinct from app.uid() then return; end if;
  if r = 'gestao' then return; end if;

  foreach s in array app.status_next(so.status) loop
    if r = any(app.status_roles(s)) then
      to_status := s; kind := 'avancar'; return next;
    end if;
  end loop;

  if r in ('atendimento', 'admin') and so.status not in ('entregue', 'cancelada') then
    for s in select e from unnest(enum_range(null::os_status)) e
              where app.status_rank(e) < app.status_rank(so.status) and e <> 'cancelada'
              order by app.status_rank(e) desc loop
      to_status := s; kind := 'voltar'; return next;
    end loop;
    to_status := 'cancelada'; kind := 'cancelar'; return next;
  end if;
end $$;

create or replace function app.change_status(p_order uuid, p_to os_status, p_note text default null) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  so service_orders;
  r user_role := app.require_role('mecanico', 'atendimento', 'admin');
  note text := nullif(trim(p_note), '');
  is_forward boolean;
  is_back boolean;
  pending_count integer;
  approved_count integer;
  open_exec_count integer;
begin
  select * into so from service_orders where id = p_order for update;
  if not found or not app.can_view_order(p_order) then
    raise exception 'OS não encontrada';
  end if;
  if so.status = p_to then
    raise exception 'A OS já está nesta etapa';
  end if;
  if so.status = 'entregue' then
    raise exception 'OS entregue não pode mudar de etapa';
  end if;
  if r = 'mecanico' and so.assigned_mechanic_id is distinct from app.uid() then
    raise exception 'Esta OS não está atribuída a você' using errcode = '42501';
  end if;

  is_forward := p_to = any(app.status_next(so.status));
  is_back := not is_forward and p_to <> 'cancelada' and app.status_rank(p_to) < app.status_rank(so.status);

  if p_to = 'cancelada' then
    if r not in ('atendimento', 'admin') then
      raise exception 'Somente atendimento ou administrador cancela uma OS' using errcode = '42501';
    end if;
    if note is null then raise exception 'Informe o motivo do cancelamento'; end if;
  elsif is_forward then
    if not (r = any(app.status_roles(p_to))) then
      raise exception 'Seu perfil não pode mover a OS para esta etapa' using errcode = '42501';
    end if;
  elsif is_back then
    if r not in ('atendimento', 'admin') or so.status = 'cancelada' then
      raise exception 'Somente atendimento ou administrador pode voltar etapas' using errcode = '42501';
    end if;
    if note is null then raise exception 'Informe o motivo para voltar a etapa'; end if;
  else
    raise exception 'Mudança de etapa não permitida';
  end if;

  -- validações de negócio ao avançar
  select count(*) filter (where approval_status = 'pendente'),
         count(*) filter (where approval_status = 'aprovado'),
         count(*) filter (where approval_status = 'aprovado' and execution_status in ('nao_iniciado', 'em_execucao'))
    into pending_count, approved_count, open_exec_count
    from service_items where service_order_id = p_order and deleted_at is null;

  if is_forward then
    if p_to = 'aguardando_aprovacao' and pending_count + approved_count = 0 then
      raise exception 'Cadastre ao menos um serviço antes de enviar para aprovação';
    end if;
    if p_to = 'servico_aprovado' then
      if pending_count > 0 then raise exception 'Ainda há serviços sem decisão do cliente'; end if;
      if approved_count = 0 then raise exception 'Nenhum serviço foi aprovado'; end if;
    end if;
    if p_to = 'pronto_retirada' and so.status = 'aguardando_aprovacao' and (pending_count > 0 or approved_count > 0) then
      raise exception 'Só é possível liberar sem serviço quando todos os itens foram recusados';
    end if;
    if p_to = 'servico_concluido' and open_exec_count > 0 then
      raise exception 'Há serviços aprovados ainda não finalizados';
    end if;
  end if;

  update service_orders
     set status = p_to,
         status_changed_at = now(),
         completed_at = case when p_to = 'servico_concluido' then now()
                             when is_back and app.status_rank(p_to) < app.status_rank('servico_concluido') then null
                             else completed_at end,
         delivered_at = case when p_to = 'entregue' then now() else delivered_at end,
         cancelled_reason = case when p_to = 'cancelada' then note else cancelled_reason end
   where id = p_order;

  if p_to = 'diagnostico_concluido' then
    update diagnoses set completed_at = now() where service_order_id = p_order;
  end if;

  insert into service_order_status_history (service_order_id, from_status, to_status, note)
  values (p_order, so.status, p_to, note);

  if is_forward then
    perform app.enqueue_status_message(p_order, p_to);
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Serviços: aprovação, execução e remoção
-- ---------------------------------------------------------------------
create or replace function app.item_total_cents(p_item service_items) returns bigint
language sql immutable
as $$ select round(p_item.quantity * p_item.part_unit_price_cents)::bigint + p_item.labor_price_cents $$;

create or replace function app.record_decision(
  p_item uuid, p_decision approval_status, p_method approval_method, p_note text default null
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare it service_items;
begin
  perform app.require_role('atendimento', 'admin');
  if p_decision = 'pendente' then raise exception 'Decisão inválida'; end if;

  select * into it from service_items where id = p_item for update;
  if not found or it.deleted_at is not null then raise exception 'Serviço não encontrado'; end if;
  if not app.can_edit_order(it.service_order_id) then
    raise exception 'OS encerrada não pode ser alterada' using errcode = '42501';
  end if;
  if p_decision = 'recusado' and it.execution_status in ('em_execucao', 'executado') then
    raise exception 'Serviço já iniciado não pode ser recusado';
  end if;

  insert into service_item_decisions (service_item_id, decision, method, customer_note, approved_total_cents)
  values (p_item, p_decision, p_method, nullif(trim(p_note), ''), app.item_total_cents(it));

  update service_items set approval_status = p_decision where id = p_item;
end $$;

create or replace function app.set_execution(p_item uuid, p_status execution_status, p_notes text default null) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare it service_items;
begin
  perform app.require_role('mecanico', 'atendimento', 'admin');
  select * into it from service_items where id = p_item for update;
  if not found or it.deleted_at is not null then raise exception 'Serviço não encontrado'; end if;
  if not app.can_edit_order(it.service_order_id) then
    raise exception 'Sem permissão para alterar esta OS' using errcode = '42501';
  end if;
  if it.approval_status <> 'aprovado' and p_status <> 'nao_iniciado' then
    raise exception 'Só é possível executar serviços aprovados pelo cliente';
  end if;

  update service_items
     set execution_status = p_status,
         execution_notes = coalesce(nullif(trim(p_notes), ''), execution_notes),
         executed_by = case when p_status in ('executado', 'nao_executado') then app.uid() end,
         executed_at = case when p_status in ('executado', 'nao_executado') then now() end
   where id = p_item;
end $$;

create or replace function app.remove_service_item(p_item uuid, p_reason text) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare it service_items;
begin
  perform app.require_role('atendimento', 'admin');
  select * into it from service_items where id = p_item for update;
  if not found or it.deleted_at is not null then raise exception 'Serviço não encontrado'; end if;
  if not app.can_edit_order(it.service_order_id) then
    raise exception 'OS encerrada não pode ser alterada' using errcode = '42501';
  end if;
  if it.approval_status <> 'pendente' and not app.is_admin() then
    raise exception 'Serviço já decidido pelo cliente não pode ser removido';
  end if;
  if nullif(trim(p_reason), '') is null then raise exception 'Informe o motivo'; end if;
  update service_items set deleted_at = now(), deleted_by = app.uid(), deleted_reason = trim(p_reason)
   where id = p_item;
end $$;

-- ---------------------------------------------------------------------
-- Mídia: exclusão lógica (somente admin)
-- ---------------------------------------------------------------------
create or replace function app.soft_delete_media(p_media uuid, p_reason text) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  perform app.require_role('admin');
  if nullif(trim(p_reason), '') is null then raise exception 'Informe o motivo'; end if;
  update media set deleted_at = now(), deleted_by = app.uid(), deleted_reason = trim(p_reason)
   where id = p_media and deleted_at is null;
  if not found then raise exception 'Arquivo não encontrado'; end if;
end $$;

-- ---------------------------------------------------------------------
-- Relatórios
-- ---------------------------------------------------------------------
create or replace function app.next_report_version(p_order uuid) returns integer
language sql stable security definer
set search_path = public, pg_temp
as $$ select coalesce(max(version), 0) + 1 from reports where service_order_id = p_order $$;

create or replace function app.register_report(p_order uuid, p_version integer, p_path text) returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare new_id uuid;
begin
  perform app.require_role('atendimento', 'admin');
  if not app.can_view_order(p_order) then raise exception 'OS não encontrada'; end if;
  insert into reports (service_order_id, version, storage_path) values (p_order, p_version, p_path)
  returning id into new_id;
  return new_id;
end $$;

-- ---------------------------------------------------------------------
-- Mensagens: ações do atendimento (modo manual) e da fila (Cloud API)
-- ---------------------------------------------------------------------
create or replace function app.message_mark_sent(p_message uuid) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  perform app.require_role('atendimento', 'admin');
  update outbound_messages
     set status = 'enviada', sent_at = now(), sent_by = app.uid()
   where id = p_message and provider = 'manual' and status in ('na_fila', 'falhou');
  if not found then raise exception 'Mensagem não está pendente de envio manual'; end if;
end $$;

create or replace function app.message_cancel(p_message uuid) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  perform app.require_role('atendimento', 'admin');
  update outbound_messages set status = 'cancelada'
   where id = p_message and status in ('na_fila', 'falhou');
  if not found then raise exception 'Mensagem não pode ser cancelada'; end if;
end $$;

-- Mensagem livre ou reenvio de modelo para o cliente da OS (sempre manual: fora de modelo aprovado)
create or replace function app.enqueue_custom_message(p_order uuid, p_body text) returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  c customers;
  new_id uuid;
begin
  perform app.require_role('atendimento', 'admin');
  if nullif(trim(p_body), '') is null then raise exception 'Mensagem vazia'; end if;
  select c2.* into c from customers c2 join service_orders so on so.customer_id = c2.id where so.id = p_order;
  if not found then raise exception 'OS não encontrada'; end if;
  if not c.whatsapp_opt_in or c.anonymized_at is not null then
    raise exception 'Cliente não autorizou mensagens pelo WhatsApp';
  end if;
  if coalesce(c.whatsapp, c.phone) is null then raise exception 'Cliente sem WhatsApp cadastrado'; end if;
  insert into outbound_messages (service_order_id, customer_id, to_phone, rendered_body, provider)
  values (p_order, c.id, coalesce(c.whatsapp, c.phone), trim(p_body), 'manual')
  returning id into new_id;
  return new_id;
end $$;

create or replace function app.enqueue_template_for_order(p_order uuid, p_template uuid) returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare new_id uuid;
begin
  perform app.require_role('atendimento', 'admin');
  if not app.can_view_order(p_order) then raise exception 'OS não encontrada'; end if;
  new_id := app.enqueue_template_message(p_order, p_template);
  if new_id is null then
    raise exception 'Mensagem não enfileirada: modelo inativo ou cliente sem autorização/WhatsApp';
  end if;
  return new_id;
end $$;

-- Fila da Cloud API (usado pela tarefa agendada no servidor)
create or replace function app.outbox_claim(p_limit integer default 20)
returns table (id uuid, to_phone text, rendered_body text, variables jsonb,
               meta_template_name text, meta_language text, meta_variables text[], attempts integer)
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  -- mensagens presas em "enviando" há mais de 10 min voltam para a fila
  update outbound_messages m set status = 'na_fila'
   where m.status = 'enviando' and m.provider = 'cloud_api'
     and coalesce(m.sent_at, m.created_at) < now() - interval '10 minutes'
     and m.provider_message_id is null;

  return query
  with picked as (
    select m.id from outbound_messages m
     where m.status = 'na_fila' and m.provider = 'cloud_api'
     order by m.created_at
     limit p_limit
     for update skip locked
  ), upd as (
    update outbound_messages m
       set status = 'enviando', attempts = m.attempts + 1, sent_at = now()
      from picked where m.id = picked.id
    returning m.*
  )
  select upd.id, upd.to_phone, upd.rendered_body, upd.variables, t.meta_template_name, t.meta_language,
         t.meta_variables, upd.attempts
    from upd left join message_templates t on t.id = upd.template_id;
end $$;

create or replace function app.outbox_complete(p_message uuid, p_ok boolean, p_provider_id text, p_error text)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if p_ok then
    update outbound_messages
       set status = 'enviada', provider_message_id = p_provider_id, sent_at = now(), last_error = null
     where id = p_message;
  else
    update outbound_messages
       set status = case when attempts >= 5 then 'falhou'::message_status else 'na_fila'::message_status end,
           last_error = left(p_error, 1000)
     where id = p_message;
  end if;
end $$;

-- Webhook da Meta: grava o evento bruto e atualiza o estado das mensagens
create or replace function app.whatsapp_ingest(p_payload jsonb) returns integer
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  st jsonb;
  updated integer := 0;
  ts timestamptz;
begin
  insert into app.whatsapp_webhook_events (payload) values (p_payload);
  for st in
    select s from jsonb_array_elements(coalesce(p_payload -> 'entry', '[]')) e,
                  jsonb_array_elements(coalesce(e -> 'changes', '[]')) ch,
                  jsonb_array_elements(coalesce(ch -> 'value' -> 'statuses', '[]')) s
  loop
    ts := to_timestamp(coalesce((st ->> 'timestamp')::bigint, extract(epoch from now())::bigint));
    update outbound_messages m set
      status = case st ->> 'status'
                 when 'delivered' then case when m.status = 'lida' then m.status else 'entregue'::message_status end
                 when 'read' then 'lida'::message_status
                 when 'failed' then 'falhou'::message_status
                 when 'sent' then case when m.status in ('na_fila', 'enviando') then 'enviada'::message_status else m.status end
                 else m.status end,
      delivered_at = case when st ->> 'status' in ('delivered', 'read') then coalesce(m.delivered_at, ts) else m.delivered_at end,
      read_at = case when st ->> 'status' = 'read' then ts else m.read_at end,
      last_error = case when st ->> 'status' = 'failed' then left((st -> 'errors')::text, 1000) else m.last_error end
    where m.provider_message_id = st ->> 'id';
    if found then updated := updated + 1; end if;
  end loop;
  return updated;
end $$;

-- ---------------------------------------------------------------------
-- Usuários (administração) e autenticação
-- ---------------------------------------------------------------------
create or replace function app.admin_create_user(
  p_username text, p_full_name text, p_role user_role, p_phone text, p_password_hash text
) returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare new_id uuid;
begin
  perform app.require_role('admin');
  insert into profiles (username, full_name, role, phone)
  values (lower(trim(p_username)), trim(p_full_name), p_role, nullif(trim(p_phone), ''))
  returning id into new_id;
  insert into app.user_credentials (user_id, password_hash, must_change_password)
  values (new_id, p_password_hash, true);
  return new_id;
end $$;

create or replace function app.admin_update_user(
  p_user uuid, p_full_name text, p_role user_role, p_phone text, p_active boolean
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  perform app.require_role('admin');
  if p_user = app.uid() and (not p_active or p_role <> 'admin') then
    raise exception 'Você não pode desativar nem remover o próprio acesso de administrador';
  end if;
  update profiles set full_name = trim(p_full_name), role = p_role, phone = nullif(trim(p_phone), ''),
                      active = p_active
   where id = p_user;
  if not found then raise exception 'Usuário não encontrado'; end if;
  if not p_active then
    delete from app.sessions where user_id = p_user;
  end if;
end $$;

create or replace function app.admin_set_password(p_user uuid, p_password_hash text) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  perform app.require_role('admin');
  update app.user_credentials set password_hash = p_password_hash, must_change_password = true, updated_at = now()
   where user_id = p_user;
  if not found then raise exception 'Usuário não encontrado'; end if;
  delete from app.sessions where user_id = p_user;
  insert into audit_log (table_name, record_id, action, changed_fields, actor_id, actor_role)
  values ('user_credentials', p_user::text, 'UPDATE', array['password_hash'], app.uid(), app.role());
end $$;

create or replace function app.change_own_password(p_password_hash text, p_keep_session text) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if app.uid() is null then raise exception 'Sessão inválida' using errcode = '42501'; end if;
  update app.user_credentials set password_hash = p_password_hash, must_change_password = false, updated_at = now()
   where user_id = app.uid();
  delete from app.sessions where user_id = app.uid() and token_hash <> p_keep_session;
  insert into audit_log (table_name, record_id, action, changed_fields, actor_id, actor_role)
  values ('user_credentials', app.uid()::text, 'UPDATE', array['password_hash'], app.uid(), app.role());
end $$;

-- Funções de login: não exigem sessão; nunca expõem dados além do necessário
create or replace function app.auth_lookup(p_username text)
returns table (user_id uuid, password_hash text, active boolean)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select p.id, c.password_hash, p.active
    from profiles p join app.user_credentials c on c.user_id = p.id
   where p.username = lower(trim(p_username))
$$;

create or replace function app.auth_password_hash(p_user uuid) returns text
language sql stable security definer
set search_path = public, pg_temp
as $$ select password_hash from app.user_credentials where user_id = p_user and p_user = app.uid() $$;

create or replace function app.auth_recent_failures(p_username text, p_ip text) returns integer
language sql stable security definer
set search_path = public, pg_temp
as $$
  select greatest(
    (select count(*) from app.login_attempts
      where username = lower(trim(p_username)) and not success and attempted_at > now() - interval '15 minutes'
        and attempted_at > coalesce((select max(attempted_at) from app.login_attempts
                                      where username = lower(trim(p_username)) and success), '-infinity')),
    (select count(*) / 4 from app.login_attempts
      where ip = p_ip and not success and attempted_at > now() - interval '15 minutes'))::integer
$$;

create or replace function app.auth_log_attempt(p_username text, p_ip text, p_success boolean) returns void
language sql security definer
set search_path = public, pg_temp
as $$
  insert into app.login_attempts (username, ip, success) values (lower(trim(p_username)), p_ip, p_success);
  delete from app.login_attempts where attempted_at < now() - interval '30 days';
$$;

create or replace function app.auth_create_session(
  p_user uuid, p_token_hash text, p_expires_at timestamptz, p_ip text, p_user_agent text
) returns void
language sql security definer
set search_path = public, pg_temp
as $$
  delete from app.sessions where expires_at < now();
  insert into app.sessions (token_hash, user_id, expires_at, ip, user_agent)
  values (p_token_hash, p_user, p_expires_at, p_ip, left(p_user_agent, 300));
$$;

create or replace function app.auth_session(p_token_hash text)
returns table (user_id uuid, username text, full_name text, role user_role, must_change_password boolean,
               expires_at timestamptz)
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  update app.sessions s set last_used_at = now()
   where s.token_hash = p_token_hash and s.last_used_at < now() - interval '5 minutes';
  return query
  select p.id, p.username, p.full_name, p.role, c.must_change_password, s.expires_at
    from app.sessions s
    join profiles p on p.id = s.user_id
    join app.user_credentials c on c.user_id = p.id
   where s.token_hash = p_token_hash and s.expires_at > now() and p.active;
end $$;

create or replace function app.auth_delete_session(p_token_hash text) returns void
language sql security definer
set search_path = public, pg_temp
as $$ delete from app.sessions where token_hash = p_token_hash $$;

-- ---------------------------------------------------------------------
-- LGPD
-- ---------------------------------------------------------------------
create or replace function app.anonymize_customer(p_customer uuid) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare pii text[] := array['name', 'phone', 'whatsapp', 'cpf', 'notes'];
begin
  perform app.require_role('admin');
  if exists (select 1 from service_orders where customer_id = p_customer and status not in ('entregue', 'cancelada')) then
    raise exception 'Cliente possui OS aberta';
  end if;
  update customers
     set name = 'Cliente anonimizado', phone = null, whatsapp = null, cpf = null, notes = null,
         whatsapp_opt_in = false, anonymized_at = now()
   where id = p_customer and anonymized_at is null;
  if not found then raise exception 'Cliente não encontrado ou já anonimizado'; end if;

  update outbound_messages set to_phone = 'anonimizado', rendered_body = '[removido — LGPD]', variables = '{}'
   where customer_id = p_customer;

  -- remove dados pessoais também do histórico de auditoria deste cliente
  update audit_log
     set old_data = case when old_data is null then null else old_data - pii || jsonb_build_object('anonimizado', true) end,
         new_data = case when new_data is null then null else new_data - pii || jsonb_build_object('anonimizado', true) end
   where table_name = 'customers' and record_id = p_customer::text;
end $$;
