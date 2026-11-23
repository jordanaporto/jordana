-- Convite de acesso: o administrador gera um link e a pessoa cria a própria senha.
-- O banco guarda só o hash do código do link; uso único; vale 48 horas.

create table app.user_invites (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id),
  token_hash  text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  created_by  uuid references profiles(id),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  used_at     timestamptz,
  revoked_at  timestamptz
);
create unique index user_invites_one_open on app.user_invites(user_id) where used_at is null and revoked_at is null;

-- gera (ou troca) o convite de um usuário; o anterior deixa de valer
create or replace function app.admin_create_invite(p_user uuid, p_token_hash text) returns timestamptz
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare exp timestamptz := now() + interval '48 hours';
begin
  perform app.require_role('admin');
  if not exists (select 1 from profiles where id = p_user and active) then
    raise exception 'Usuário não encontrado ou desativado';
  end if;
  update app.user_invites set revoked_at = now() where user_id = p_user and used_at is null and revoked_at is null;
  insert into app.user_invites (user_id, token_hash, created_by, expires_at) values (p_user, p_token_hash, app.uid(), exp);
  insert into audit_log (table_name, record_id, action, changed_fields, actor_id, actor_role)
  values ('user_invites', p_user::text, 'INSERT', array['convite_gerado'], app.uid(), app.role());
  return exp;
end $$;

create or replace function app.admin_revoke_invite(p_user uuid) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  perform app.require_role('admin');
  update app.user_invites set revoked_at = now() where user_id = p_user and used_at is null and revoked_at is null;
end $$;

-- situação de acesso de cada usuário (tela do administrador)
create or replace function app.admin_users_access()
returns table (user_id uuid, must_change_password boolean, invite_expires_at timestamptz, last_login_at timestamptz)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  perform app.require_role('admin');
  return query
    select p.id, coalesce(c.must_change_password, true),
           (select i.expires_at from app.user_invites i
             where i.user_id = p.id and i.used_at is null and i.revoked_at is null and i.expires_at > now()),
           (select max(s.created_at) from app.sessions s where s.user_id = p.id)
      from profiles p left join app.user_credentials c on c.user_id = p.id;
end $$;

-- página pública do convite: só mostra nome e usuário se o link for válido
create or replace function app.invite_lookup(p_token_hash text)
returns table (full_name text, username text)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select p.full_name, p.username
    from app.user_invites i join profiles p on p.id = i.user_id
   where i.token_hash = p_token_hash and i.used_at is null and i.revoked_at is null
     and i.expires_at > now() and p.active
$$;

-- a pessoa cria a senha: convite usado, sessões antigas encerradas, auditoria
create or replace function app.invite_accept(p_token_hash text, p_password_hash text) returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare inv app.user_invites; r user_role;
begin
  select i.* into inv from app.user_invites i join profiles p on p.id = i.user_id
   where i.token_hash = p_token_hash and i.used_at is null and i.revoked_at is null
     and i.expires_at > now() and p.active
   for update of i;
  if inv.id is null then raise exception 'Este link expirou ou já foi usado. Peça um novo ao administrador.'; end if;

  update app.user_invites set used_at = now() where id = inv.id;
  insert into app.user_credentials (user_id, password_hash, must_change_password)
  values (inv.user_id, p_password_hash, false)
  on conflict (user_id) do update set password_hash = excluded.password_hash, must_change_password = false, updated_at = now();
  delete from app.sessions where user_id = inv.user_id;
  select role into r from profiles where id = inv.user_id;
  insert into audit_log (table_name, record_id, action, changed_fields, actor_id, actor_role)
  values ('user_credentials', inv.user_id::text, 'UPDATE', array['password_hash', 'convite_usado'], inv.user_id, r);
  return inv.user_id;
end $$;

revoke all on app.user_invites from public;
grant execute on all functions in schema app to injecar_app;
