-- =====================================================================
-- Produto genérico: "Sistema de Serviço para Oficina".
-- O nome da oficina vem de settings.company.name (variável {oficina}).
-- =====================================================================

-- textos padrão das mensagens passam a usar a variável {oficina}
update message_templates set body = replace(body, 'equipe da Injecar', 'equipe da {oficina}')
 where body like '%equipe da Injecar%';
update message_templates set body = replace(body, 'na Injecar', 'na {oficina}')
 where body like '%na Injecar%';
update message_templates set body = replace(body, ' Injecar. Aqui, nós resolvemos.', ' Equipe {oficina}.')
 where body like '%Injecar. Aqui, nós resolvemos.%';

-- instalação nova (empresa ainda não configurada): nome neutro
update settings
   set value = value || jsonb_build_object('name', 'Minha Oficina', 'address', '')
 where key = 'company' and coalesce(value ->> 'cnpj', '') = '' and value ->> 'name' = 'Injecar Auto Center';

-- nomes padrão quando a empresa não tem nome cadastrado
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
           'oficina', coalesce(nullif(app.setting('company') ->> 'name', ''), 'nossa oficina'))
    from service_orders so
    join customers c on c.id = so.customer_id
    join vehicles v on v.id = so.vehicle_id
   where so.id = p_order
$$;

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
           'oficina', coalesce(nullif(app.setting('company') ->> 'name', ''), 'nossa oficina'),
           'endereco', coalesce(app.setting('company') ->> 'address', ''))
    from appointments a
    join customers c on c.id = a.customer_id
    left join vehicles v on v.id = a.vehicle_id
   where a.id = p_appt
$$;

create or replace function app.push_test() returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if app.role() is null then raise exception 'Sessão inválida' using errcode = '42501'; end if;
  perform app.notify_user(app.uid(), coalesce(nullif(app.setting('company') ->> 'name', ''), 'Sistema de Serviço para Oficina'),
                          'Avisos ativados neste aparelho.', '/');
end $$;

revoke execute on all functions in schema app from public;
grant execute on all functions in schema app to injecar_app;
