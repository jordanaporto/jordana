-- OS abertas antes do link de acompanhamento: cria o link na primeira vez que a ficha é aberta
create or replace function app.tracking_info(p_order uuid)
returns table (url text, views int, last_viewed timestamptz, subscribers int)
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare u text;
begin
  perform app.require_role('atendimento', 'admin', 'gestao');
  if not app.can_view_order(p_order) then raise exception 'OS não encontrada'; end if;
  u := app.tracking_url(p_order);
  return query
    select u, l.view_count, l.last_viewed_at,
           (select count(*)::int from app.tracking_subscriptions s where s.link_id = l.id)
      from tracking_links l
     where l.service_order_id = p_order and l.revoked_at is null;
end $$;

grant execute on function app.tracking_info(uuid) to injecar_app;
