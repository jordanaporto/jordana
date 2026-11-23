-- Trava do orçamento contra alterações indevidas
--
-- 1. Depois da decisão do cliente, nada do que ele aprovou muda (nome, descrição, peça,
--    quantidade, valores, prioridade) — só o administrador, e fica registrado na OS.
-- 2. O mecânico só mexe nos serviços enquanto o orçamento não foi preparado; depois disso
--    ele pode apenas sugerir serviços novos (sem valor, dependem de nova aprovação).

create or replace function app.tg_service_item_guard() returns trigger
language plpgsql
as $$
declare
  r user_role := app.role();
  st os_status;
begin
  if r = 'mecanico' then
    if tg_op = 'INSERT' then
      new.part_unit_price_cents := 0;
      new.labor_price_cents := 0;
    else
      if new.part_unit_price_cents is distinct from old.part_unit_price_cents
         or new.labor_price_cents is distinct from old.labor_price_cents then
        raise exception 'Mecânico não altera valores do orçamento' using errcode = '42501';
      end if;
      select status into st from service_orders where id = old.service_order_id;
      if st >= 'orcamento_em_preparacao'
         and (new.title, new.description, new.part_name, new.quantity, new.priority)
             is distinct from (old.title, old.description, old.part_name, old.quantity, old.priority) then
        raise exception 'O orçamento já foi preparado. Para mudar, cadastre um serviço novo ou fale com o atendimento.'
          using errcode = '42501';
      end if;
    end if;
  end if;

  if tg_op = 'UPDATE' and old.deleted_at is not null and r is not null then
    raise exception 'Serviço removido não pode ser alterado' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and old.approval_status <> 'pendente' and r is distinct from 'admin' and r is not null
     and (new.title, new.description, new.part_name, new.quantity, new.part_unit_price_cents, new.labor_price_cents, new.priority)
         is distinct from
         (old.title, old.description, old.part_name, old.quantity, old.part_unit_price_cents, old.labor_price_cents, old.priority) then
    raise exception 'Este serviço já foi decidido pelo cliente. Cadastre um novo serviço para alterar.'
      using errcode = '42501';
  end if;
  return new;
end $$;

-- Alteração do administrador em serviço já decidido: aparece nas observações da OS
-- (além da auditoria), com o valor aprovado pelo cliente e o novo valor.
create or replace function app.tg_service_item_admin_change() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  antes bigint := app.item_total_cents(old);
  depois bigint := app.item_total_cents(new);
  fmt text;
begin
  if old.approval_status = 'pendente' or app.role() is null then return new; end if;
  if (new.title, new.description, new.part_name, new.quantity, new.part_unit_price_cents, new.labor_price_cents, new.priority)
     is not distinct from
     (old.title, old.description, old.part_name, old.quantity, old.part_unit_price_cents, old.labor_price_cents, old.priority) then
    return new;
  end if;
  fmt := 'Serviço já ' || case old.approval_status when 'aprovado' then 'aprovado' else 'recusado' end
         || ' pelo cliente foi alterado pelo administrador: “' || old.title || '”'
         || case when new.title is distinct from old.title then ' → “' || new.title || '”' else '' end
         || case when antes <> depois
                 then '. Valor: R$ ' || replace(to_char(antes / 100.0, 'FM9999999990.00'), '.', ',') || ' → R$ ' || replace(to_char(depois / 100.0, 'FM9999999990.00'), '.', ',')
                 else '' end;
  insert into service_order_notes (service_order_id, body, is_system) values (new.service_order_id, fmt, true);
  return new;
end $$;

drop trigger if exists service_items_admin_change on service_items;
create trigger service_items_admin_change after update on service_items
  for each row execute function app.tg_service_item_admin_change();

grant execute on function app.tg_service_item_admin_change() to injecar_app;
