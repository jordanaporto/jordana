-- =====================================================================
-- Link de acompanhamento do cliente
--   - página pública por OS (token aleatório, sem login)
--   - aprovação/recusa do orçamento pelo próprio cliente (método "link")
--   - notificações gratuitas no celular do cliente (Web Push)
-- =====================================================================

create table tracking_links (
  id                uuid primary key default gen_random_uuid(),
  service_order_id  uuid not null references service_orders(id),
  token             text not null unique check (token ~ '^[A-Za-z0-9_-]{24,64}$'),
  created_at        timestamptz not null default now(),
  created_by        uuid references profiles(id),
  revoked_at        timestamptz,
  expires_at        timestamptz,
  last_viewed_at    timestamptz,
  view_count        integer not null default 0
);
create unique index tracking_links_one_active on tracking_links(service_order_id) where revoked_at is null;

alter table tracking_links enable row level security;
revoke all on tracking_links from injecar_app;
grant select on tracking_links to injecar_app;
create policy tracking_links_read on tracking_links for select to injecar_app
  using (app.can_read_all() and app.can_view_order(service_order_id));

create table app.tracking_subscriptions (
  id               uuid primary key default gen_random_uuid(),
  link_id          uuid not null references tracking_links(id),
  endpoint         text not null unique check (length(endpoint) <= 1000),
  p256dh           text not null check (length(p256dh) <= 200),
  auth             text not null check (length(auth) <= 100),
  user_agent       text,
  created_at       timestamptz not null default now(),
  last_success_at  timestamptz,
  failures         integer not null default 0
);

create table app.tracking_notifications (
  id          bigint generated always as identity primary key,
  link_id     uuid not null references tracking_links(id),
  title       text not null,
  body        text,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);
create index tracking_notifications_pending on app.tracking_notifications(created_at) where sent_at is null;

-- endereço público do sistema (preenchido pelas migrações a partir de APP_URL)
create or replace function app.public_url() returns text
language sql stable security definer
set search_path = public, pg_temp
as $$ select rtrim(coalesce(app.setting('app.public_url') #>> '{}', ''), '/') $$;

-- garante um link ativo para a OS e devolve o token
create or replace function app.ensure_tracking_link(p_order uuid) returns text
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare tok text;
begin
  select token into tok from tracking_links where service_order_id = p_order and revoked_at is null;
  if tok is null then
    -- 2 UUIDs aleatórios = 244 bits de aleatoriedade (sem depender de extensões)
    tok := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
    insert into tracking_links (service_order_id, token, created_by) values (p_order, tok, app.uid());
  end if;
  return tok;
end $$;

create or replace function app.tracking_url(p_order uuid) returns text
language sql security definer
set search_path = public, pg_temp
as $$ select case when app.public_url() = '' then '' else app.public_url() || '/acompanhar/' || app.ensure_tracking_link(p_order) end $$;

-- resumo do link para a ficha da OS (equipe): endereço, acessos e quantos celulares ativaram avisos
create or replace function app.tracking_info(p_order uuid)
returns table (url text, views int, last_viewed timestamptz, subscribers int)
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  perform app.require_role('atendimento', 'admin', 'gestao');
  if not app.can_view_order(p_order) then raise exception 'OS não encontrada'; end if;
  return query
    select app.tracking_url(p_order), l.view_count, l.last_viewed_at,
           (select count(*)::int from app.tracking_subscriptions s where s.link_id = l.id)
      from tracking_links l
     where l.service_order_id = p_order and l.revoked_at is null;
end $$;

-- novo link (o anterior deixa de funcionar)
create or replace function app.tracking_regenerate(p_order uuid) returns text
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  perform app.require_role('atendimento', 'admin');
  if not app.can_view_order(p_order) then raise exception 'OS não encontrada'; end if;
  update tracking_links set revoked_at = now() where service_order_id = p_order and revoked_at is null;
  return app.ensure_tracking_link(p_order);
end $$;

-- variável {link} nas mensagens da OS
create or replace function app.message_variables(p_order uuid) returns jsonb
language sql security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
           'nome', split_part(trim(c.name), ' ', 1),
           'nome_completo', c.name,
           'modelo', v.model,
           'marca', v.brand,
           'placa', v.plate,
           'numero_os', lpad(so.number::text, 4, '0'),
           'oficina', coalesce(nullif(app.setting('company') ->> 'name', ''), 'nossa oficina'),
           'link', app.tracking_url(so.id))
    from service_orders so
    join customers c on c.id = so.customer_id
    join vehicles v on v.id = so.vehicle_id
   where so.id = p_order
$$;

-- a mensagem de "veículo recebido" passa a levar o link
update message_templates
   set body = body || E'\n\nAcompanhe o andamento do seu veículo por aqui: {link}'
 where trigger_status = 'recebido' and body not like '%{link}%';

-- ---------------------------------------------------------------------
-- O que o cliente vê (somente leitura, sem dados internos)
-- ---------------------------------------------------------------------
create or replace function app.tracking_link_for(p_token text) returns tracking_links
language sql stable security definer
set search_path = public, pg_temp
as $$
  select * from tracking_links
   where token = p_token and revoked_at is null and (expires_at is null or expires_at > now())
$$;

create or replace function app.tracking_view(p_token text) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  l tracking_links;
  res jsonb;
begin
  l := app.tracking_link_for(p_token);
  if l.id is null then return null; end if;
  update tracking_links set view_count = view_count + 1, last_viewed_at = now() where id = l.id;

  select jsonb_build_object(
    'oficina', jsonb_build_object(
       'nome', coalesce(nullif(app.setting('company') ->> 'name', ''), ''),
       'telefone', coalesce(app.setting('company') ->> 'phone', ''),
       'whatsapp', coalesce(app.setting('company') ->> 'whatsapp', ''),
       'endereco', coalesce(app.setting('company') ->> 'address', '')),
    'os', jsonb_build_object(
       'numero', lpad(so.number::text, 4, '0'),
       'status', so.status,
       'status_desde', so.status_changed_at,
       'entrada', so.entry_at,
       'km', so.entry_km,
       'reclamacao', so.complaint,
       'entregue_em', so.delivered_at),
    'cliente', split_part(trim(c.name), ' ', 1),
    'veiculo', jsonb_build_object('placa', v.plate, 'marca', v.brand, 'modelo', v.model, 'ano', v.year),
    'historico', coalesce((
       select jsonb_agg(jsonb_build_object('status', h.to_status, 'em', h.changed_at) order by h.changed_at, h.id)
         from service_order_status_history h
        where h.service_order_id = so.id and h.to_status <> 'cancelada'), '[]'),
    'diagnostico', (
       select jsonb_build_object('causa', d.root_cause, 'recomendacao', d.recommendation)
         from diagnoses d where d.service_order_id = so.id and (d.root_cause is not null or d.recommendation is not null)),
    'servicos', case when so.status in ('recebido', 'em_inspecao', 'em_diagnostico', 'diagnostico_concluido', 'orcamento_em_preparacao')
                     then '[]'::jsonb
                     else coalesce((
       select jsonb_agg(jsonb_build_object(
                'id', si.id, 'titulo', si.title, 'descricao', si.description, 'peca', si.part_name,
                'quantidade', si.quantity, 'prioridade', si.priority, 'total', app.item_total_cents(si),
                'decisao', si.approval_status, 'execucao', si.execution_status)
              order by case si.priority when 'urgente' then 0 when 'recomendado' then 1 else 2 end, si.created_at)
         from service_items si where si.service_order_id = so.id and si.deleted_at is null), '[]') end,
    'pode_aprovar', so.status = 'aguardando_aprovacao',
    'midias', coalesce((
       select jsonb_agg(jsonb_build_object('id', m.id, 'tipo', m.kind, 'legenda', coalesce(m.caption, e.item_name)) order by m.created_at)
         from media m left join service_order_checklist e on e.id = m.checklist_entry_id
        where m.service_order_id = so.id and m.deleted_at is null), '[]'),
    'notificacoes', (select count(*) from app.tracking_subscriptions s where s.link_id = l.id))
    into res
    from service_orders so
    join customers c on c.id = so.customer_id
    join vehicles v on v.id = so.vehicle_id
   where so.id = l.service_order_id;
  return res;
end $$;

create or replace function app.tracking_media(p_token text, p_media uuid)
returns table (storage_path text, thumb_path text, mime_type text, kind media_kind)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select m.storage_path, m.thumb_path, m.mime_type, m.kind
    from media m
   where m.id = p_media and m.deleted_at is null
     and m.service_order_id = (app.tracking_link_for(p_token)).service_order_id
$$;

-- ---------------------------------------------------------------------
-- Aprovação pelo cliente
-- ---------------------------------------------------------------------
create or replace function app.tracking_decide(p_token text, p_item uuid, p_decision approval_status, p_note text default null)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  l tracking_links;
  so service_orders;
  it service_items;
  pending integer;
  car text;
begin
  l := app.tracking_link_for(p_token);
  if l.id is null then raise exception 'Link inválido ou expirado'; end if;
  if p_decision not in ('aprovado', 'recusado') then raise exception 'Decisão inválida'; end if;
  select * into so from service_orders where id = l.service_order_id for update;
  if so.status <> 'aguardando_aprovacao' then
    raise exception 'O orçamento não está aguardando sua aprovação no momento';
  end if;
  select * into it from service_items where id = p_item and service_order_id = so.id and deleted_at is null for update;
  if not found then raise exception 'Serviço não encontrado'; end if;
  if it.approval_status = p_decision then return jsonb_build_object('ok', true); end if;

  insert into service_item_decisions (service_item_id, decision, method, customer_note, approved_total_cents)
  values (p_item, p_decision, 'link', nullif(left(trim(p_note), 500), ''), app.item_total_cents(it));
  update service_items set approval_status = p_decision where id = p_item;

  select count(*) into pending from service_items
   where service_order_id = so.id and deleted_at is null and approval_status = 'pendente';
  if pending = 0 then
    select v.plate || ' · ' || v.model into car from vehicles v where v.id = so.vehicle_id;
    perform app.notify_roles(array['atendimento', 'admin']::user_role[], 'Cliente respondeu o orçamento: ' || car,
                             'Todas as decisões foram registradas pelo link. Confirme para seguir.',
                             '/os/' || so.id || '/servicos', null);
  end if;
  return jsonb_build_object('ok', true, 'pendentes', pending);
end $$;

-- ---------------------------------------------------------------------
-- Notificações no celular do cliente
-- ---------------------------------------------------------------------
create or replace function app.tracking_subscribe(p_token text, p_endpoint text, p_p256dh text, p_auth text, p_user_agent text)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare l tracking_links;
begin
  l := app.tracking_link_for(p_token);
  if l.id is null then raise exception 'Link inválido ou expirado'; end if;
  insert into app.tracking_subscriptions (link_id, endpoint, p256dh, auth, user_agent)
  values (l.id, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
     set link_id = excluded.link_id, p256dh = excluded.p256dh, auth = excluded.auth, failures = 0;
  insert into app.tracking_notifications (link_id, title, body)
  values (l.id, 'Notificações ativadas', 'Você será avisado a cada etapa do serviço no seu veículo.');
end $$;

create or replace function app.tg_notify_customer() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  l tracking_links;
  model text;
  msg text;
begin
  select * into l from tracking_links where service_order_id = new.service_order_id and revoked_at is null;
  if l.id is null or not exists (select 1 from app.tracking_subscriptions where link_id = l.id) then return null; end if;
  msg := case new.to_status
    when 'em_inspecao' then 'Começamos a inspeção do seu veículo.'
    when 'em_diagnostico' then 'Estamos fazendo os testes para identificar o problema.'
    when 'aguardando_aprovacao' then 'O orçamento está pronto. Toque para ver e aprovar.'
    when 'em_manutencao' then 'Os serviços aprovados foram iniciados.'
    when 'aguardando_peca' then 'Estamos aguardando uma peça para continuar.'
    when 'em_teste' then 'Serviço feito. Agora estamos testando o veículo.'
    when 'pronto_retirada' then 'Seu veículo está pronto para retirada!'
    else null end;
  if msg is null then return null; end if;
  select v.model into model from service_orders so join vehicles v on v.id = so.vehicle_id where so.id = new.service_order_id;
  insert into app.tracking_notifications (link_id, title, body) values (l.id, 'Seu ' || model, msg);
  return null;
end $$;

create trigger history_notify_customer after insert on service_order_status_history
  for each row execute function app.tg_notify_customer();

-- link expira 30 dias depois da entrega/cancelamento
create or replace function app.tg_tracking_expire() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if new.to_status in ('entregue', 'cancelada') then
    update tracking_links set expires_at = now() + interval '30 days'
     where service_order_id = new.service_order_id and revoked_at is null;
  end if;
  return null;
end $$;

create trigger history_tracking_expire after insert on service_order_status_history
  for each row execute function app.tg_tracking_expire();

create or replace function app.tracking_notifications_claim(p_limit integer default 100)
returns table (notification_id bigint, subscription_id uuid, endpoint text, p256dh text, auth text,
               title text, body text, token text)
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  return query
  with picked as (
    select n.id from app.tracking_notifications n
     where n.sent_at is null and n.created_at > now() - interval '1 day'
     order by n.id limit p_limit
     for update skip locked
  ), upd as (
    update app.tracking_notifications n set sent_at = now() from picked where n.id = picked.id
    returning n.*
  )
  select upd.id, s.id, s.endpoint, s.p256dh, s.auth, upd.title, upd.body, l.token
    from upd
    join app.tracking_subscriptions s on s.link_id = upd.link_id
    join tracking_links l on l.id = upd.link_id
   order by upd.id;
end $$;

create or replace function app.tracking_push_result(p_subscription uuid, p_ok boolean, p_gone boolean) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if p_gone then
    delete from app.tracking_subscriptions where id = p_subscription;
  elsif p_ok then
    update app.tracking_subscriptions set last_success_at = now(), failures = 0 where id = p_subscription;
  else
    update app.tracking_subscriptions set failures = failures + 1 where id = p_subscription;
    delete from app.tracking_subscriptions where id = p_subscription and failures > 10;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Mensagem com o link (manual), pelo atendimento
-- ---------------------------------------------------------------------
create or replace function app.enqueue_tracking_message(p_order uuid) returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  vars jsonb;
  oficina text;
begin
  perform app.require_role('atendimento', 'admin');
  vars := app.message_variables(p_order);
  if coalesce(vars ->> 'link', '') = '' then raise exception 'Endereço público do sistema não configurado (APP_URL)'; end if;
  oficina := vars ->> 'oficina';
  return app.enqueue_custom_message(p_order,
    'Olá, ' || (vars ->> 'nome') || '! Acompanhe o serviço do seu ' || (vars ->> 'modelo') || ' na ' || oficina ||
    ' por este link: ' || (vars ->> 'link') ||
    E'\n\nPor ele você vê cada etapa, as fotos e o orçamento, e pode ativar avisos no celular.');
end $$;

create trigger tracking_links_audit after insert or update or delete on tracking_links
  for each row execute function app.tg_audit();

revoke all on all tables in schema app from public;
revoke execute on all functions in schema app from public;
grant execute on all functions in schema app to injecar_app;
