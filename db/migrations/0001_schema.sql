-- =====================================================================
-- Injecar Auto Center — esquema principal
-- =====================================================================
-- Convenções:
--   * dinheiro em centavos (bigint)
--   * datas em timestamptz (UTC), exibidas em America/Belem
--   * colunas created_by/updated_by/autor são preenchidas por trigger a partir
--     do usuário da sessão (app.user_id) — o cliente não consegue falsificar
--   * o schema "app" guarda funções e tabelas internas (credenciais, sessões),
--     inacessíveis diretamente pela aplicação
-- =====================================================================

create schema if not exists app;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type user_role as enum ('mecanico', 'atendimento', 'admin', 'gestao');

create type fuel_type as enum ('gasolina', 'etanol', 'flex', 'diesel', 'gnv', 'hibrido', 'eletrico', 'outro');

create type os_status as enum (
  'recebido',
  'em_inspecao',
  'em_diagnostico',
  'diagnostico_concluido',
  'orcamento_em_preparacao',
  'aguardando_aprovacao',
  'servico_aprovado',
  'em_manutencao',
  'aguardando_peca',
  'em_teste',
  'servico_concluido',
  'pronto_retirada',
  'entregue',
  'cancelada'
);

create type checklist_result as enum ('ok', 'atencao', 'necessita_reparo', 'nao_avaliado');
create type media_kind       as enum ('foto', 'video');
create type service_priority as enum ('urgente', 'recomendado', 'pode_acompanhar');
create type approval_status  as enum ('pendente', 'aprovado', 'recusado');
create type approval_method  as enum ('presencial', 'telefone', 'whatsapp', 'link');
create type execution_status as enum ('nao_iniciado', 'em_execucao', 'executado', 'nao_executado');
create type message_provider as enum ('manual', 'cloud_api');
create type message_status   as enum ('na_fila', 'enviando', 'enviada', 'entregue', 'lida', 'falhou', 'cancelada');

-- ---------------------------------------------------------------------
-- Usuários e autenticação
-- ---------------------------------------------------------------------
create table profiles (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null check (length(trim(full_name)) between 2 and 120),
  username    text not null unique check (username ~ '^[a-z0-9._-]{3,30}$'),
  role        user_role not null,
  phone       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  created_by  uuid references profiles(id),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references profiles(id)
);

create table app.user_credentials (
  user_id               uuid primary key references profiles(id),
  password_hash         text not null,
  must_change_password  boolean not null default false,
  updated_at            timestamptz not null default now()
);

create table app.sessions (
  token_hash    text primary key,
  user_id       uuid not null references profiles(id),
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  last_used_at  timestamptz not null default now(),
  ip            text,
  user_agent    text
);
create index sessions_user_idx on app.sessions(user_id);

create table app.login_attempts (
  id            bigint generated always as identity primary key,
  username      text not null,
  ip            text,
  success       boolean not null,
  attempted_at  timestamptz not null default now()
);
create index login_attempts_lookup_idx on app.login_attempts(username, attempted_at desc);
create index login_attempts_ip_idx on app.login_attempts(ip, attempted_at desc);

-- ---------------------------------------------------------------------
-- Clientes e veículos
-- ---------------------------------------------------------------------
create table customers (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null check (length(trim(name)) between 2 and 160),
  phone               text check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  whatsapp            text check (whatsapp ~ '^\+[1-9][0-9]{7,14}$'),
  cpf                 text unique check (cpf ~ '^[0-9]{11}$'),
  notes               text check (length(notes) <= 4000),
  whatsapp_opt_in     boolean not null default false,
  whatsapp_opt_in_at  timestamptz,
  whatsapp_opt_in_by  uuid references profiles(id),
  anonymized_at       timestamptz,
  created_at          timestamptz not null default now(),
  created_by          uuid references profiles(id),
  updated_at          timestamptz not null default now(),
  updated_by          uuid references profiles(id)
);
create index customers_name_idx on customers (lower(name));
create index customers_phone_idx on customers (phone);
create index customers_whatsapp_idx on customers (whatsapp);

create table vehicles (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references customers(id),
  plate        text not null unique check (plate ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$'),
  brand        text not null check (length(trim(brand)) between 1 and 60),
  model        text not null check (length(trim(model)) between 1 and 80),
  version      text check (length(version) <= 80),
  year         smallint check (year between 1950 and 2100),
  engine       text check (length(engine) <= 60),
  fuel         fuel_type,
  current_km   integer check (current_km between 0 and 3000000),
  color        text check (length(color) <= 40),
  notes        text check (length(notes) <= 4000),
  created_at   timestamptz not null default now(),
  created_by   uuid references profiles(id),
  updated_at   timestamptz not null default now(),
  updated_by   uuid references profiles(id)
);
create index vehicles_customer_idx on vehicles(customer_id);

-- ---------------------------------------------------------------------
-- Ordem de serviço
-- ---------------------------------------------------------------------
create table service_orders (
  id                    uuid primary key default gen_random_uuid(),
  number                integer generated always as identity unique,
  vehicle_id            uuid not null references vehicles(id),
  customer_id           uuid not null references customers(id),
  entry_km              integer not null check (entry_km between 0 and 3000000),
  entry_at              timestamptz not null default now(),
  assigned_mechanic_id  uuid references profiles(id),
  complaint             text not null check (length(trim(complaint)) between 2 and 4000),
  intake_notes          text check (length(intake_notes) <= 4000),
  status                os_status not null default 'recebido',
  status_changed_at     timestamptz not null default now(),
  last_activity_at      timestamptz not null default now(),
  final_notes           text check (length(final_notes) <= 4000),
  completed_at          timestamptz,
  delivered_at          timestamptz,
  cancelled_reason      text,
  created_at            timestamptz not null default now(),
  created_by            uuid references profiles(id),
  updated_at            timestamptz not null default now(),
  updated_by            uuid references profiles(id)
);
create index service_orders_vehicle_idx on service_orders(vehicle_id, entry_at desc);
create index service_orders_customer_idx on service_orders(customer_id);
create index service_orders_mechanic_idx on service_orders(assigned_mechanic_id) where status not in ('entregue', 'cancelada');
create index service_orders_status_idx on service_orders(status);
-- no máximo uma OS aberta por veículo
create unique index service_orders_one_open_per_vehicle
  on service_orders(vehicle_id) where status not in ('entregue', 'cancelada');

-- Linha do tempo — só inserção (via função)
create table service_order_status_history (
  id                uuid primary key default gen_random_uuid(),
  service_order_id  uuid not null references service_orders(id),
  from_status       os_status,
  to_status         os_status not null,
  note              text check (length(note) <= 2000),
  changed_by        uuid references profiles(id),
  changed_at        timestamptz not null default now()
);
create index status_history_order_idx on service_order_status_history(service_order_id, changed_at);

-- Observações — só inserção
create table service_order_notes (
  id                uuid primary key default gen_random_uuid(),
  service_order_id  uuid not null references service_orders(id),
  body              text not null check (length(trim(body)) between 1 and 4000),
  is_system         boolean not null default false,
  author_id         uuid references profiles(id),
  created_at        timestamptz not null default now()
);
create index notes_order_idx on service_order_notes(service_order_id, created_at);

-- ---------------------------------------------------------------------
-- Checklist personalizável
-- ---------------------------------------------------------------------
create table checklist_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (length(trim(name)) between 2 and 80),
  position    integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  created_by  uuid references profiles(id),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references profiles(id)
);

create table checklist_items (
  id           uuid primary key default gen_random_uuid(),
  category_id  uuid not null references checklist_categories(id),
  name         text not null check (length(trim(name)) between 2 and 120),
  position     integer not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  created_by   uuid references profiles(id),
  updated_at   timestamptz not null default now(),
  updated_by   uuid references profiles(id),
  unique (category_id, name)
);

-- Cópia do checklist para cada OS (nomes copiados: renomear o modelo não altera OS antigas)
create table service_order_checklist (
  id                 uuid primary key default gen_random_uuid(),
  service_order_id   uuid not null references service_orders(id),
  checklist_item_id  uuid references checklist_items(id),
  category_name      text not null,
  category_position  integer not null default 0,
  item_name          text not null,
  position           integer not null default 0,
  result             checklist_result not null default 'nao_avaliado',
  note               text check (length(note) <= 2000),
  created_at         timestamptz not null default now(),
  created_by         uuid references profiles(id),
  updated_at         timestamptz not null default now(),
  updated_by         uuid references profiles(id),
  unique (service_order_id, checklist_item_id)
);
create index so_checklist_order_idx on service_order_checklist(service_order_id);

-- ---------------------------------------------------------------------
-- Diagnóstico
-- ---------------------------------------------------------------------
create table diagnoses (
  id                uuid primary key default gen_random_uuid(),
  service_order_id  uuid not null unique references service_orders(id),
  reported_symptom  text check (length(reported_symptom) <= 4000),
  tests_performed   text check (length(tests_performed) <= 4000),
  results           text check (length(results) <= 4000),
  root_cause        text check (length(root_cause) <= 4000),
  components        text check (length(components) <= 4000),
  recommendation    text check (length(recommendation) <= 4000),
  technical_notes   text check (length(technical_notes) <= 4000),
  completed_at      timestamptz,
  created_at        timestamptz not null default now(),
  created_by        uuid references profiles(id),
  updated_at        timestamptz not null default now(),
  updated_by        uuid references profiles(id)
);

-- ---------------------------------------------------------------------
-- Serviços recomendados / orçamento / aprovação / execução
-- ---------------------------------------------------------------------
create table service_items (
  id                     uuid primary key default gen_random_uuid(),
  service_order_id       uuid not null references service_orders(id),
  title                  text not null check (length(trim(title)) between 2 and 160),
  description            text check (length(description) <= 2000),
  part_name              text check (length(part_name) <= 160),
  quantity               numeric(10,2) not null default 1 check (quantity > 0 and quantity <= 9999),
  part_unit_price_cents  bigint not null default 0 check (part_unit_price_cents between 0 and 100000000),
  labor_price_cents      bigint not null default 0 check (labor_price_cents between 0 and 100000000),
  priority               service_priority not null default 'recomendado',
  approval_status        approval_status not null default 'pendente',
  execution_status       execution_status not null default 'nao_iniciado',
  executed_by            uuid references profiles(id),
  executed_at            timestamptz,
  execution_notes        text check (length(execution_notes) <= 2000),
  deleted_at             timestamptz,
  deleted_by             uuid references profiles(id),
  deleted_reason         text,
  created_at             timestamptz not null default now(),
  created_by             uuid references profiles(id),
  updated_at             timestamptz not null default now(),
  updated_by             uuid references profiles(id)
);
create index service_items_order_idx on service_items(service_order_id);

-- Cada decisão do cliente — só inserção
create table service_item_decisions (
  id                    uuid primary key default gen_random_uuid(),
  service_item_id       uuid not null references service_items(id),
  decision              approval_status not null check (decision <> 'pendente'),
  method                approval_method not null,
  customer_note         text check (length(customer_note) <= 2000),
  approved_total_cents  bigint not null,
  recorded_by           uuid references profiles(id),
  decided_at            timestamptz not null default now()
);
create index decisions_item_idx on service_item_decisions(service_item_id, decided_at);

-- ---------------------------------------------------------------------
-- Mídia (fotos e vídeos) — arquivos em armazenamento privado
-- ---------------------------------------------------------------------
create table media (
  id                  uuid primary key default gen_random_uuid(),
  vehicle_id          uuid not null references vehicles(id),
  service_order_id    uuid not null references service_orders(id),
  checklist_entry_id  uuid references service_order_checklist(id),
  diagnosis_id        uuid references diagnoses(id),
  service_item_id     uuid references service_items(id),
  kind                media_kind not null,
  storage_path        text not null unique,
  thumb_path          text,
  mime_type           text not null check (mime_type ~ '^(image/(jpeg|png|webp)|video/(mp4|quicktime|webm))$'),
  size_bytes          bigint not null check (size_bytes > 0 and size_bytes <= 104857600),
  duration_seconds    integer check (duration_seconds between 0 and 600),
  caption             text check (length(caption) <= 500),
  include_in_report   boolean not null default false,
  uploaded_by         uuid references profiles(id),
  created_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  deleted_by          uuid references profiles(id),
  deleted_reason      text
);
create index media_order_idx on media(service_order_id, created_at);
create index media_vehicle_idx on media(vehicle_id);

-- ---------------------------------------------------------------------
-- Mensagens ao cliente (WhatsApp)
-- ---------------------------------------------------------------------
create table message_templates (
  id                  uuid primary key default gen_random_uuid(),
  trigger_status      os_status unique,
  name                text not null check (length(trim(name)) between 2 and 80),
  body                text not null check (length(trim(body)) between 2 and 1024),
  meta_template_name  text check (meta_template_name ~ '^[a-z0-9_]{1,250}$'),
  meta_language       text not null default 'pt_BR',
  meta_variables      text[] not null default '{}',
  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  created_by          uuid references profiles(id),
  updated_at          timestamptz not null default now(),
  updated_by          uuid references profiles(id)
);

create table outbound_messages (
  id                   uuid primary key default gen_random_uuid(),
  service_order_id     uuid references service_orders(id),
  customer_id          uuid not null references customers(id),
  template_id          uuid references message_templates(id),
  trigger_status       os_status,
  to_phone             text not null,
  rendered_body        text not null,
  variables            jsonb not null default '{}',
  provider             message_provider not null,
  status               message_status not null default 'na_fila',
  provider_message_id  text unique,
  attempts             integer not null default 0,
  last_error           text,
  sent_at              timestamptz,
  sent_by              uuid references profiles(id),
  delivered_at         timestamptz,
  read_at              timestamptz,
  created_at           timestamptz not null default now(),
  created_by           uuid references profiles(id)
);
create index outbound_status_idx on outbound_messages(status, created_at);
create index outbound_order_idx on outbound_messages(service_order_id, created_at);

create table app.whatsapp_webhook_events (
  id           bigint generated always as identity primary key,
  payload      jsonb not null,
  received_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Relatórios, configurações e auditoria
-- ---------------------------------------------------------------------
create table reports (
  id                uuid primary key default gen_random_uuid(),
  service_order_id  uuid not null references service_orders(id),
  storage_path      text not null unique,
  version           integer not null,
  generated_by      uuid references profiles(id),
  generated_at      timestamptz not null default now(),
  unique (service_order_id, version)
);

create table settings (
  key         text primary key check (key ~ '^[a-z0-9_.]+$'),
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references profiles(id)
);

create table audit_log (
  id              bigint generated always as identity primary key,
  table_name      text not null,
  record_id       text,
  service_order_id uuid,
  action          text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_data        jsonb,
  new_data        jsonb,
  changed_fields  text[],
  actor_id        uuid,
  actor_role      user_role,
  occurred_at     timestamptz not null default now()
);
create index audit_log_record_idx on audit_log(table_name, record_id, occurred_at desc);
create index audit_log_actor_idx on audit_log(actor_id, occurred_at desc);
create index audit_log_time_idx on audit_log(occurred_at desc);
create index audit_log_order_idx on audit_log(service_order_id, occurred_at desc) where service_order_id is not null;
