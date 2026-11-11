-- =====================================================================
-- Contexto do usuário, regras de visibilidade e triggers genéricos
-- =====================================================================
-- A aplicação abre uma transação por requisição e executa
--   select set_config('app.user_id', '<uuid>', true)
-- Tudo o que o banco decide (permissões, autoria, auditoria) parte daí.

create or replace function app.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('app.user_id', true), '')::uuid $$;

create or replace function app.role() returns user_role
language sql stable security definer
set search_path = public, pg_temp
as $$ select role from public.profiles where id = app.uid() and active $$;

create or replace function app.is_staff() returns boolean
language sql stable
as $$ select coalesce(app.role() in ('atendimento', 'admin'), false) $$;

create or replace function app.is_admin() returns boolean
language sql stable
as $$ select coalesce(app.role() = 'admin', false) $$;

create or replace function app.can_read_all() returns boolean
language sql stable
as $$ select coalesce(app.role() in ('atendimento', 'admin', 'gestao'), false) $$;

-- Mecânico vê: OS atribuídas a ele + histórico dos veículos que estão com ele agora
create or replace function app.can_view_order(p_order uuid) returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select case
    when app.can_read_all() then true
    when app.role() = 'mecanico' then exists (
      select 1 from service_orders so
       where so.id = p_order
         and (so.assigned_mechanic_id = app.uid()
              or exists (select 1 from service_orders cur
                          where cur.vehicle_id = so.vehicle_id
                            and cur.assigned_mechanic_id = app.uid()
                            and cur.status not in ('entregue', 'cancelada'))))
    else false
  end
$$;

create or replace function app.can_view_vehicle(p_vehicle uuid) returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select case
    when app.can_read_all() then true
    when app.role() = 'mecanico' then exists (
      select 1 from service_orders cur
       where cur.vehicle_id = p_vehicle
         and cur.assigned_mechanic_id = app.uid()
         and cur.status not in ('entregue', 'cancelada'))
    else false
  end
$$;

-- Quem pode registrar coisas na OS (checklist, fotos, diagnóstico, serviços)
--   admin: sempre
--   atendimento: enquanto a OS não foi entregue/cancelada
--   mecânico: OS atribuída a ele, até "Serviço concluído"
create or replace function app.can_edit_order(p_order uuid) returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from service_orders so
     where so.id = p_order
       and case app.role()
             when 'admin' then true
             when 'atendimento' then so.status not in ('entregue', 'cancelada')
             when 'mecanico' then so.assigned_mechanic_id = app.uid()
                                  and so.status not in ('pronto_retirada', 'entregue', 'cancelada')
             else false
           end)
$$;

create or replace function app.require_role(variadic p_roles user_role[]) returns user_role
language plpgsql stable
as $$
declare r user_role := app.role();
begin
  if r is null then
    raise exception 'Sessão inválida ou usuário inativo' using errcode = '42501';
  end if;
  if not (r = any(p_roles)) then
    raise exception 'Seu perfil não tem permissão para esta ação' using errcode = '42501';
  end if;
  return r;
end $$;

-- ---------------------------------------------------------------------
-- Autoria automática: created_* / updated_* não podem ser falsificados
-- ---------------------------------------------------------------------
create or replace function app.tg_stamp() returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := coalesce(app.uid(), new.created_by);
    new.updated_at := now();
    new.updated_by := coalesce(app.uid(), new.updated_by);
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.updated_at := now();
    new.updated_by := coalesce(app.uid(), new.updated_by);
  end if;
  return new;
end $$;

-- Define a coluna de autor indicada em TG_ARGV[0] como o usuário da sessão (e a data em TG_ARGV[1])
create or replace function app.tg_author() returns trigger
language plpgsql
as $$
declare patch jsonb := '{}'::jsonb;
begin
  if app.uid() is not null then
    patch := patch || jsonb_build_object(tg_argv[0], app.uid());
  end if;
  if tg_nargs > 1 then
    patch := patch || jsonb_build_object(tg_argv[1], now());
  end if;
  new := jsonb_populate_record(new, patch);
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Auditoria
-- ---------------------------------------------------------------------
create or replace function app.tg_audit() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  o jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  n jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  changed text[];
  rec jsonb := coalesce(n, o);
  order_id uuid;
begin
  if tg_op = 'UPDATE' then
    select array_agg(k order by k) into changed
      from jsonb_object_keys(n) k
     where (o -> k) is distinct from (n -> k);
    -- ignora "toques" técnicos (atividade/updated_at) sem alteração real
    if changed is null
       or changed <@ array['last_activity_at', 'updated_at', 'updated_by', 'last_used_at']::text[] then
      return null;
    end if;
  end if;

  if tg_table_name = 'service_orders' then
    order_id := (rec ->> 'id')::uuid;
  elsif rec ? 'service_order_id' then
    order_id := (rec ->> 'service_order_id')::uuid;
  elsif tg_table_name = 'service_item_decisions' then
    select service_order_id into order_id from service_items where id = (rec ->> 'service_item_id')::uuid;
  end if;

  insert into audit_log (table_name, record_id, service_order_id, action, old_data, new_data,
                         changed_fields, actor_id, actor_role)
  values (tg_table_name, coalesce(rec ->> 'id', rec ->> 'key'), order_id, tg_op, o, n,
          changed, app.uid(), app.role());
  return null;
end $$;

-- ---------------------------------------------------------------------
-- Última atividade da OS (alerta "sem atualização")
-- ---------------------------------------------------------------------
create or replace function app.tg_touch_order() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare order_id uuid := (to_jsonb(new) ->> 'service_order_id')::uuid;
begin
  if order_id is null and tg_table_name = 'service_item_decisions' then
    select service_order_id into order_id from service_items where id = new.service_item_id;
  end if;
  update service_orders set last_activity_at = now() where id = order_id;
  return null;
end $$;

-- ---------------------------------------------------------------------
-- Regras específicas por tabela
-- ---------------------------------------------------------------------

-- Consentimento de WhatsApp: registra quando e quem
create or replace function app.tg_customer_opt_in() returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' or new.whatsapp_opt_in is distinct from old.whatsapp_opt_in then
    if new.whatsapp_opt_in then
      new.whatsapp_opt_in_at := now();
      new.whatsapp_opt_in_by := app.uid();
    else
      new.whatsapp_opt_in_at := null;
      new.whatsapp_opt_in_by := null;
    end if;
  else
    new.whatsapp_opt_in_at := old.whatsapp_opt_in_at;
    new.whatsapp_opt_in_by := old.whatsapp_opt_in_by;
  end if;
  return new;
end $$;

-- Serviços: mecânico não define preço; item já decidido não muda condições comerciais
create or replace function app.tg_service_item_guard() returns trigger
language plpgsql
as $$
declare r user_role := app.role();
begin
  if r = 'mecanico' then
    if tg_op = 'INSERT' then
      new.part_unit_price_cents := 0;
      new.labor_price_cents := 0;
    elsif new.part_unit_price_cents is distinct from old.part_unit_price_cents
       or new.labor_price_cents is distinct from old.labor_price_cents then
      raise exception 'Mecânico não altera valores do orçamento' using errcode = '42501';
    end if;
  end if;

  if tg_op = 'UPDATE' and old.deleted_at is not null and r is not null then
    raise exception 'Serviço removido não pode ser alterado' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and old.approval_status <> 'pendente' and r is distinct from 'admin' and r is not null
     and (new.title, new.part_name, new.quantity, new.part_unit_price_cents, new.labor_price_cents)
         is distinct from
         (old.title, old.part_name, old.quantity, old.part_unit_price_cents, old.labor_price_cents) then
    raise exception 'Este serviço já foi decidido pelo cliente. Cadastre um novo serviço para alterar.'
      using errcode = '42501';
  end if;
  return new;
end $$;

-- Mídia: o veículo vem da OS; vínculos precisam pertencer à mesma OS
create or replace function app.tg_media_links() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  select vehicle_id into new.vehicle_id from service_orders where id = new.service_order_id;
  if new.vehicle_id is null then
    raise exception 'OS inexistente';
  end if;
  if new.checklist_entry_id is not null and not exists (
       select 1 from service_order_checklist where id = new.checklist_entry_id and service_order_id = new.service_order_id) then
    raise exception 'Item do checklist não pertence a esta OS';
  end if;
  if new.diagnosis_id is not null and not exists (
       select 1 from diagnoses where id = new.diagnosis_id and service_order_id = new.service_order_id) then
    raise exception 'Diagnóstico não pertence a esta OS';
  end if;
  if new.service_item_id is not null and not exists (
       select 1 from service_items where id = new.service_item_id and service_order_id = new.service_order_id) then
    raise exception 'Serviço não pertence a esta OS';
  end if;
  new.uploaded_by := coalesce(app.uid(), new.uploaded_by);
  new.created_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Instala os triggers
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  -- autoria padrão
  foreach t in array array['profiles', 'customers', 'vehicles', 'service_orders', 'checklist_categories',
                           'checklist_items', 'service_order_checklist', 'diagnoses', 'service_items',
                           'message_templates']
  loop
    execute format('create trigger %I before insert or update on %I for each row execute function app.tg_stamp()',
                   t || '_stamp', t);
  end loop;

  -- auditoria
  foreach t in array array['profiles', 'customers', 'vehicles', 'service_orders', 'service_order_status_history',
                           'service_order_notes', 'checklist_categories', 'checklist_items',
                           'service_order_checklist', 'diagnoses', 'service_items', 'service_item_decisions',
                           'media', 'message_templates', 'reports', 'settings']
  loop
    execute format('create trigger %I after insert or update or delete on %I for each row execute function app.tg_audit()',
                   t || '_audit', t);
  end loop;

  -- última atividade da OS
  foreach t in array array['service_order_status_history', 'service_order_notes', 'service_order_checklist',
                           'diagnoses', 'service_items', 'service_item_decisions', 'media']
  loop
    execute format('create trigger %I after insert or update on %I for each row execute function app.tg_touch_order()',
                   t || '_touch', t);
  end loop;
end $$;

create trigger notes_author before insert on service_order_notes
  for each row execute function app.tg_author('author_id', 'created_at');
create trigger history_author before insert on service_order_status_history
  for each row execute function app.tg_author('changed_by', 'changed_at');
create trigger decisions_author before insert on service_item_decisions
  for each row execute function app.tg_author('recorded_by', 'decided_at');
create trigger reports_author before insert on reports
  for each row execute function app.tg_author('generated_by', 'generated_at');
create trigger settings_author before insert or update on settings
  for each row execute function app.tg_author('updated_by', 'updated_at');
create trigger outbound_author before insert on outbound_messages
  for each row execute function app.tg_author('created_by', 'created_at');

create trigger customers_opt_in before insert or update on customers
  for each row execute function app.tg_customer_opt_in();
create trigger service_items_guard before insert or update on service_items
  for each row execute function app.tg_service_item_guard();
create trigger media_links before insert on media
  for each row execute function app.tg_media_links();
