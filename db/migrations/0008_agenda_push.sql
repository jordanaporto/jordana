-- =====================================================================
-- Agenda (confirmação + lembretes 1 dia e 2 horas antes pelo WhatsApp)
-- e avisos no celular da equipe (Web Push)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Agenda
-- ---------------------------------------------------------------------
create type appointment_status as enum ('agendado', 'confirmado', 'compareceu', 'faltou', 'cancelado');

create table appointments (
  id                uuid primary key default gen_random_uuid(),
  customer_id       uuid not null references customers(id),
  vehicle_id        uuid references vehicles(id),
  scheduled_at      timestamptz not null,
  duration_minutes  integer not null default 60 check (duration_minutes between 15 and 600),
  service           text not null check (length(trim(service)) between 2 and 200),
  notes             text check (length(notes) <= 2000),
  status            appointment_status not null default 'agendado',
  service_order_id  uuid references service_orders(id),
  cancelled_reason  text check (length(cancelled_reason) <= 500),
  created_at        timestamptz not null default now(),
  created_by        uuid references profiles(id),
  updated_at        timestamptz not null default now(),
  updated_by        uuid references profiles(id)
);
create index appointments_time_idx on appointments(scheduled_at);
create index appointments_customer_idx on appointments(customer_id);

create trigger appointments_stamp before insert or update on appointments
  for each row execute function app.tg_stamp();
create trigger appointments_audit after insert or update or delete on appointments
  for each row execute function app.tg_audit();

-- mensagens agendadas (lembretes) e ligadas a um agendamento
alter table outbound_messages
  add column appointment_id uuid references appointments(id),
  add column trigger_event  text,
  add column send_after     timestamptz not null default now();
create index outbound_due_idx on outbound_messages(status, send_after);
create index outbound_appointment_idx on outbound_messages(appointment_id) where appointment_id is not null;

-- modelos de mensagem disparados por evento da agenda
alter table message_templates
  add column trigger_event text unique
    check (trigger_event in ('agendamento_confirmacao', 'agendamento_lembrete_1d', 'agendamento_lembrete_2h')),
  add constraint message_templates_one_trigger check (trigger_status is null or trigger_event is null);

-- variáveis para mensagens de agendamento
create or replace function app.appointment_variables(p_appt uuid) returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
           'nome', split_part(trim(c.name), ' ', 1),
           'nome_completo', c.name,
           'modelo', coalesce(v.model, 'veículo'),
           'marca', coalesce(v.brand, ''),
           'placa', coalesce(v.plate, ''),
           'servico', a.service,
           'data', to_char(a.scheduled_at at time zone 'America/Belem', 'DD/MM'),
           'hora', to_char(a.scheduled_at at time zone 'America/Belem', 'HH24:MI'),
           'dia_semana', (array['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'])
                           [extract(dow from a.scheduled_at at time zone 'America/Belem')::int + 1],
           'oficina', coalesce(app.setting('company') ->> 'name', 'Injecar Auto Center'),
           'endereco', coalesce(app.setting('company') ->> 'address', ''))
    from appointments a
    join customers c on c.id = a.customer_id
    left join vehicles v on v.id = a.vehicle_id
   where a.id = p_appt
$$;

create or replace function app.enqueue_appointment_message(p_appt uuid, p_event text, p_send_after timestamptz) returns uuid
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
  select * into t from message_templates where trigger_event = p_event and active;
  if not found then return null; end if;
  select c2.* into c from customers c2 join appointments a on a.customer_id = c2.id where a.id = p_appt;
  if not found or not c.whatsapp_opt_in or c.anonymized_at is not null or coalesce(c.whatsapp, c.phone) is null then
    return null;
  end if;
  vars := app.appointment_variables(p_appt);
  prov := coalesce(app.setting('messaging.provider') #>> '{}', 'manual')::message_provider;
  if prov = 'cloud_api' and t.meta_template_name is null then prov := 'manual'; end if;

  insert into outbound_messages (customer_id, appointment_id, template_id, trigger_event, to_phone, rendered_body,
                                 variables, provider, send_after)
  values (c.id, p_appt, t.id, p_event, coalesce(c.whatsapp, c.phone), app.render_message(t.body, vars), vars, prov,
          p_send_after)
  returning id into new_id;
  return new_id;
end $$;

-- (re)programa confirmação + lembretes; cancela os pendentes anteriores
create or replace function app.schedule_appointment_messages(p_appt uuid, p_send_confirmation boolean default true)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare a appointments;
begin
  select * into a from appointments where id = p_appt;
  update outbound_messages set status = 'cancelada'
   where appointment_id = p_appt and status in ('na_fila', 'falhou');
  if a.status not in ('agendado', 'confirmado') then return; end if;
  if p_send_confirmation and a.scheduled_at > now() then
    perform app.enqueue_appointment_message(p_appt, 'agendamento_confirmacao', now());
  end if;
  if a.scheduled_at - interval '1 day' > now() + interval '30 minutes' then
    perform app.enqueue_appointment_message(p_appt, 'agendamento_lembrete_1d', a.scheduled_at - interval '1 day');
  end if;
  if a.scheduled_at - interval '2 hours' > now() then
    perform app.enqueue_appointment_message(p_appt, 'agendamento_lembrete_2h', a.scheduled_at - interval '2 hours');
  end if;
end $$;

create or replace function app.create_appointment(
  p_customer uuid, p_vehicle uuid, p_at timestamptz, p_duration integer, p_service text, p_notes text
) returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare new_id uuid;
begin
  perform app.require_role('atendimento', 'admin');
  if p_at < now() - interval '5 minutes' then raise exception 'Escolha uma data e horário futuros'; end if;
  if exists (select 1 from customers where id = p_customer and anonymized_at is not null) then
    raise exception 'Cliente anonimizado';
  end if;
  if p_vehicle is not null and not exists (select 1 from vehicles where id = p_vehicle and customer_id = p_customer) then
    raise exception 'O veículo não pertence a este cliente';
  end if;
  insert into appointments (customer_id, vehicle_id, scheduled_at, duration_minutes, service, notes)
  values (p_customer, p_vehicle, p_at, coalesce(p_duration, 60), trim(p_service), nullif(trim(p_notes), ''))
  returning id into new_id;
  perform app.schedule_appointment_messages(new_id, true);
  return new_id;
end $$;

create or replace function app.update_appointment(
  p_id uuid, p_vehicle uuid, p_at timestamptz, p_duration integer, p_service text, p_notes text
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare a appointments;
begin
  perform app.require_role('atendimento', 'admin');
  select * into a from appointments where id = p_id for update;
  if not found then raise exception 'Agendamento não encontrado'; end if;
  if a.status not in ('agendado', 'confirmado') then raise exception 'Este agendamento não pode mais ser alterado'; end if;
  if p_at < now() - interval '5 minutes' then raise exception 'Escolha uma data e horário futuros'; end if;
  if p_vehicle is not null and not exists (select 1 from vehicles where id = p_vehicle and customer_id = a.customer_id) then
    raise exception 'O veículo não pertence a este cliente';
  end if;
  update appointments
     set vehicle_id = p_vehicle, scheduled_at = p_at, duration_minutes = coalesce(p_duration, 60),
         service = trim(p_service), notes = nullif(trim(p_notes), ''),
         status = case when p_at <> a.scheduled_at then 'agendado'::appointment_status else status end
   where id = p_id;
  -- nova data/serviço: nova confirmação e lembretes refeitos
  if p_at <> a.scheduled_at or trim(p_service) <> a.service then
    perform app.schedule_appointment_messages(p_id, true);
  end if;
end $$;

create or replace function app.set_appointment_status(p_id uuid, p_status appointment_status, p_reason text default null)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare a appointments;
begin
  perform app.require_role('atendimento', 'admin');
  select * into a from appointments where id = p_id for update;
  if not found then raise exception 'Agendamento não encontrado'; end if;
  if a.status not in ('agendado', 'confirmado') then raise exception 'Este agendamento já foi encerrado'; end if;
  if p_status not in ('confirmado', 'faltou', 'cancelado') then raise exception 'Situação inválida'; end if;
  if p_status = 'cancelado' and nullif(trim(p_reason), '') is null then raise exception 'Informe o motivo do cancelamento'; end if;
  update appointments set status = p_status, cancelled_reason = nullif(trim(p_reason), '') where id = p_id;
  if p_status in ('faltou', 'cancelado') then
    update outbound_messages set status = 'cancelada'
     where appointment_id = p_id and status in ('na_fila', 'falhou');
  end if;
end $$;

-- cliente chegou: vira OS (já com cliente e veículo)
create or replace function app.convert_appointment(p_id uuid, p_entry_km integer, p_mechanic uuid, p_complaint text)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  a appointments;
  order_id uuid;
begin
  perform app.require_role('atendimento', 'admin');
  select * into a from appointments where id = p_id for update;
  if not found then raise exception 'Agendamento não encontrado'; end if;
  if a.status not in ('agendado', 'confirmado') then raise exception 'Este agendamento já foi encerrado'; end if;
  if a.vehicle_id is null then raise exception 'Informe o veículo do agendamento antes de abrir a OS'; end if;
  order_id := app.open_service_order(a.customer_id, a.vehicle_id, p_entry_km, p_mechanic,
                                     coalesce(nullif(trim(p_complaint), ''), a.service), a.notes);
  update appointments set status = 'compareceu', service_order_id = order_id where id = p_id;
  update outbound_messages set status = 'cancelada'
   where appointment_id = p_id and status in ('na_fila', 'falhou');
  return order_id;
end $$;

-- a fila só entrega mensagens cujo horário chegou
create or replace function app.outbox_claim(p_limit integer default 20)
returns table (id uuid, to_phone text, rendered_body text, variables jsonb,
               meta_template_name text, meta_language text, meta_variables text[], attempts integer)
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  update outbound_messages m set status = 'na_fila'
   where m.status = 'enviando' and m.provider = 'cloud_api'
     and coalesce(m.sent_at, m.created_at) < now() - interval '10 minutes'
     and m.provider_message_id is null;

  return query
  with picked as (
    select m.id from outbound_messages m
     where m.status = 'na_fila' and m.provider = 'cloud_api' and m.send_after <= now()
     order by m.send_after
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

-- envio manual de lembrete antes da hora não faz sentido: só mensagens já liberadas
create or replace function app.message_mark_sent(p_message uuid) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  perform app.require_role('atendimento', 'admin');
  update outbound_messages
     set status = 'enviada', sent_at = now(), sent_by = app.uid()
   where id = p_message and provider = 'manual' and status in ('na_fila', 'falhou') and send_after <= now() + interval '1 hour';
  if not found then raise exception 'Mensagem não está pendente de envio manual'; end if;
end $$;

-- RLS e permissões
alter table appointments enable row level security;
revoke all on appointments from injecar_app;
grant select on appointments to injecar_app;
create policy appointments_read on appointments for select to injecar_app using (app.can_read_all());

-- modelos de mensagem: coluna nova também editável pelo admin
grant insert (trigger_event) on message_templates to injecar_app;
grant update (trigger_event) on message_templates to injecar_app;

-- modelos iniciais da agenda
insert into message_templates (trigger_event, name, body, meta_variables, active) values
  ('agendamento_confirmacao', 'Agendamento confirmado',
   'Olá, {nome}! Seu horário na Injecar está marcado para {dia_semana}, {data} às {hora}: {servico} no seu {modelo}. Endereço: {endereco}. Se precisar remarcar, é só responder por aqui.',
   array['nome', 'dia_semana', 'data', 'hora', 'servico', 'modelo', 'endereco'], true),
  ('agendamento_lembrete_1d', 'Lembrete: 1 dia antes',
   'Olá, {nome}! Passando para lembrar do seu horário amanhã, {data} às {hora}, para {servico} no seu {modelo}. Te esperamos na Injecar!',
   array['nome', 'data', 'hora', 'servico', 'modelo'], true),
  ('agendamento_lembrete_2h', 'Lembrete: 2 horas antes',
   '{nome}, seu horário na Injecar é hoje às {hora}. Estamos te esperando! Endereço: {endereco}.',
   array['nome', 'hora', 'endereco'], true);

-- ---------------------------------------------------------------------
-- Alertas: visão completa (sem filtro de usuário) usada pelos avisos
-- ---------------------------------------------------------------------
create or replace view app.alerts_all as
with cfg as (
  select coalesce((app.setting('alert.no_update_hours') #>> '{}')::numeric, 4)             as no_update_h,
         coalesce((app.setting('alert.approval_max_hours') #>> '{}')::numeric, 24)         as approval_h,
         coalesce((app.setting('alert.waiting_part_max_hours') #>> '{}')::numeric, 72)     as part_h,
         coalesce((app.setting('alert.diagnosis_max_hours') #>> '{}')::numeric, 24)        as diag_h,
         coalesce((app.setting('alert.ready_not_notified_minutes') #>> '{}')::numeric, 30) as ready_min
), o as (
  select so.id, so.number, so.status, so.status_changed_at, so.assigned_mechanic_id, v.plate, v.model,
         m.full_name as mechanic_name,
         extract(epoch from (now() - so.status_changed_at)) / 3600.0 as hours_in_status,
         extract(epoch from (now() - so.last_activity_at)) / 3600.0 as hours_since_activity
    from service_orders so
    join vehicles v on v.id = so.vehicle_id
    left join profiles m on m.id = so.assigned_mechanic_id
   where so.status not in ('entregue', 'cancelada')
)
select o.id as service_order_id, o.number, o.plate, o.model, o.status, o.mechanic_name,
       'sem_atualizacao'::text as kind, 'Sem atualização há ' || floor(o.hours_since_activity) || ' h' as message,
       o.hours_since_activity as hours, 1 as severity, o.assigned_mechanic_id
  from o, cfg
 where o.hours_since_activity > cfg.no_update_h
   and o.status not in ('aguardando_aprovacao', 'aguardando_peca', 'pronto_retirada')
union all
select o.id, o.number, o.plate, o.model, o.status, o.mechanic_name,
       'aguardando_aprovacao', 'Orçamento aguardando aprovação há ' || floor(o.hours_in_status) || ' h',
       o.hours_in_status, 2, o.assigned_mechanic_id
  from o, cfg
 where o.status = 'aguardando_aprovacao' and o.hours_in_status > cfg.approval_h
union all
select o.id, o.number, o.plate, o.model, o.status, o.mechanic_name,
       'pronto_sem_aviso', 'Pronto para retirada e cliente ainda não avisado',
       o.hours_in_status, 3, o.assigned_mechanic_id
  from o, cfg
 where o.status = 'pronto_retirada'
   and o.hours_in_status * 60 > cfg.ready_min
   and not exists (select 1 from outbound_messages om
                    where om.service_order_id = o.id
                      and om.status in ('enviada', 'entregue', 'lida')
                      and coalesce(om.sent_at, om.created_at) >= o.status_changed_at)
union all
select o.id, o.number, o.plate, o.model, o.status, o.mechanic_name,
       'aguardando_peca', 'Parado aguardando peça há ' || floor(o.hours_in_status) || ' h',
       o.hours_in_status, 2, o.assigned_mechanic_id
  from o, cfg
 where o.status = 'aguardando_peca' and o.hours_in_status > cfg.part_h
union all
select o.id, o.number, o.plate, o.model, o.status, o.mechanic_name,
       'diagnostico_demorado', 'Diagnóstico acima do limite (' || floor(o.hours_in_status) || ' h)',
       o.hours_in_status, 2, o.assigned_mechanic_id
  from o, cfg
 where o.status = 'em_diagnostico' and o.hours_in_status > cfg.diag_h;

create or replace view v_alerts as
select service_order_id, number, plate, model, status, mechanic_name, kind, message, hours, severity
  from app.alerts_all
 where app.can_view_order(service_order_id);

-- ---------------------------------------------------------------------
-- Avisos no celular da equipe (Web Push)
-- ---------------------------------------------------------------------
create table app.push_subscriptions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references profiles(id),
  endpoint         text not null unique check (length(endpoint) <= 1000),
  p256dh           text not null check (length(p256dh) <= 200),
  auth             text not null check (length(auth) <= 100),
  user_agent       text,
  created_at       timestamptz not null default now(),
  last_success_at  timestamptz,
  failures         integer not null default 0
);
create index push_subscriptions_user_idx on app.push_subscriptions(user_id);

create table app.notifications (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references profiles(id),
  title       text not null,
  body        text,
  url         text,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);
create index notifications_pending_idx on app.notifications(created_at) where sent_at is null;

create table app.alert_notified (
  service_order_id  uuid not null,
  kind              text not null,
  notified_at       timestamptz not null default now(),
  primary key (service_order_id, kind)
);

create or replace function app.notify_user(p_user uuid, p_title text, p_body text, p_url text) returns void
language sql security definer
set search_path = public, pg_temp
as $$
  insert into app.notifications (user_id, title, body, url)
  select p.id, left(p_title, 120), left(p_body, 300), p_url
    from profiles p
   where p.id = p_user and p.active
     and exists (select 1 from app.push_subscriptions s where s.user_id = p.id);
$$;

create or replace function app.notify_roles(p_roles user_role[], p_title text, p_body text, p_url text, p_except uuid default null)
returns void
language sql security definer
set search_path = public, pg_temp
as $$
  insert into app.notifications (user_id, title, body, url)
  select p.id, left(p_title, 120), left(p_body, 300), p_url
    from profiles p
   where p.role = any(p_roles) and p.active and p.id is distinct from p_except
     and exists (select 1 from app.push_subscriptions s where s.user_id = p.id);
$$;

-- eventos de etapa que interessam a cada perfil
create or replace function app.tg_notify_status() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  so record;
  car text;
  url text := '/os/' || new.service_order_id;
begin
  select o.assigned_mechanic_id, v.plate, v.model into so
    from service_orders o join vehicles v on v.id = o.vehicle_id where o.id = new.service_order_id;
  car := so.plate || ' · ' || so.model;
  case new.to_status
    when 'diagnostico_concluido' then
      perform app.notify_roles(array['atendimento', 'admin']::user_role[], 'Diagnóstico concluído: ' || car,
                               'Pronto para preparar o orçamento.', url || '/servicos', new.changed_by);
    when 'servico_aprovado' then
      if so.assigned_mechanic_id is distinct from new.changed_by then
        perform app.notify_user(so.assigned_mechanic_id, 'Serviço aprovado: ' || car,
                                'O cliente aprovou. Pode iniciar os serviços.', url || '/servicos');
      end if;
    when 'aguardando_peca' then
      perform app.notify_roles(array['atendimento', 'admin']::user_role[], 'Aguardando peça: ' || car,
                               coalesce(new.note, 'O mecânico está aguardando peça.'), url, new.changed_by);
    when 'servico_concluido' then
      perform app.notify_roles(array['atendimento', 'admin']::user_role[], 'Serviço concluído: ' || car,
                               'Conferir e liberar para retirada.', url || '/relatorio', new.changed_by);
    else null;
  end case;
  return null;
end $$;

create trigger history_notify after insert on service_order_status_history
  for each row execute function app.tg_notify_status();

-- carro atribuído a um mecânico
create or replace function app.tg_notify_assignment() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare car text;
begin
  if new.assigned_mechanic_id is null
     or (tg_op = 'UPDATE' and new.assigned_mechanic_id is not distinct from old.assigned_mechanic_id)
     or new.assigned_mechanic_id = app.uid() then
    return null;
  end if;
  select v.plate || ' · ' || v.model into car from vehicles v where v.id = new.vehicle_id;
  perform app.notify_user(new.assigned_mechanic_id, 'Novo carro para você: ' || car, left(new.complaint, 200),
                          '/os/' || new.id);
  return null;
end $$;

create trigger service_orders_notify_assignment after insert or update of assigned_mechanic_id on service_orders
  for each row execute function app.tg_notify_assignment();

-- alertas novos viram aviso (uma vez por OS e tipo, enquanto o alerta estiver ativo)
create or replace function app.collect_alert_notifications() returns integer
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  r record;
  n integer := 0;
begin
  delete from app.alert_notified an
   where not exists (select 1 from app.alerts_all a where a.service_order_id = an.service_order_id and a.kind = an.kind);
  for r in
    select a.* from app.alerts_all a
     where not exists (select 1 from app.alert_notified an where an.service_order_id = a.service_order_id and an.kind = a.kind)
  loop
    insert into app.alert_notified (service_order_id, kind) values (r.service_order_id, r.kind);
    perform app.notify_roles(array['atendimento', 'admin']::user_role[], 'Alerta: ' || r.plate || ' · ' || r.model,
                             r.message, '/os/' || r.service_order_id, null);
    if r.kind in ('sem_atualizacao', 'diagnostico_demorado') and r.assigned_mechanic_id is not null then
      perform app.notify_user(r.assigned_mechanic_id, 'Atenção: ' || r.plate || ' · ' || r.model, r.message,
                              '/os/' || r.service_order_id);
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;

-- inscrição do aparelho do usuário logado
create or replace function app.push_subscribe(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if app.role() is null then raise exception 'Sessão inválida' using errcode = '42501'; end if;
  insert into app.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (app.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
     set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
         user_agent = excluded.user_agent, failures = 0;
end $$;

create or replace function app.push_unsubscribe(p_endpoint text) returns void
language sql security definer
set search_path = public, pg_temp
as $$ delete from app.push_subscriptions where endpoint = p_endpoint and user_id = app.uid() $$;

create or replace function app.push_my_devices() returns integer
language sql stable security definer
set search_path = public, pg_temp
as $$ select count(*)::int from app.push_subscriptions where user_id = app.uid() $$;

create or replace function app.push_test() returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if app.role() is null then raise exception 'Sessão inválida' using errcode = '42501'; end if;
  perform app.notify_user(app.uid(), 'Injecar OS', 'Avisos ativados neste aparelho.', '/');
end $$;

-- fila de envio (usada pelo servidor): uma linha por aparelho
create or replace function app.notifications_claim(p_limit integer default 50)
returns table (notification_id bigint, subscription_id uuid, endpoint text, p256dh text, auth text,
               title text, body text, url text)
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  return query
  with picked as (
    select n.id from app.notifications n
     where n.sent_at is null and n.created_at > now() - interval '1 day'
     order by n.id limit p_limit
     for update skip locked
  ), upd as (
    update app.notifications n set sent_at = now() from picked where n.id = picked.id
    returning n.*
  )
  select upd.id, s.id, s.endpoint, s.p256dh, s.auth, upd.title, upd.body, upd.url
    from upd join app.push_subscriptions s on s.user_id = upd.user_id;
end $$;

create or replace function app.push_result(p_subscription uuid, p_ok boolean, p_gone boolean) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if p_gone then
    delete from app.push_subscriptions where id = p_subscription;
  elsif p_ok then
    update app.push_subscriptions set last_success_at = now(), failures = 0 where id = p_subscription;
  else
    update app.push_subscriptions set failures = failures + 1 where id = p_subscription;
    delete from app.push_subscriptions where id = p_subscription and failures > 10;
  end if;
end $$;

revoke all on all tables in schema app from public;
revoke execute on all functions in schema app from public;
grant execute on all functions in schema app to injecar_app;
