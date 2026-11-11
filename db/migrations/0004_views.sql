-- =====================================================================
-- Views de leitura (listas, dashboard, alertas, indicadores)
-- As views rodam com os direitos do dono, por isso cada uma aplica
-- explicitamente as regras de visibilidade (app.can_view_order etc.).
-- =====================================================================

create or replace view v_service_order_totals as
select so.id as service_order_id,
       count(si.id) filter (where si.deleted_at is null)                                         as items_count,
       count(si.id) filter (where si.deleted_at is null and si.approval_status = 'pendente')     as pending_count,
       count(si.id) filter (where si.deleted_at is null and si.approval_status = 'aprovado')     as approved_count,
       count(si.id) filter (where si.deleted_at is null and si.approval_status = 'recusado')     as refused_count,
       count(si.id) filter (where si.deleted_at is null and si.execution_status = 'executado')   as executed_count,
       coalesce(sum(app.item_total_cents(si)) filter (where si.deleted_at is null), 0)::bigint   as total_cents,
       coalesce(sum(app.item_total_cents(si)) filter (where si.deleted_at is null and si.approval_status = 'aprovado'), 0)::bigint as approved_cents,
       coalesce(sum(app.item_total_cents(si)) filter (where si.deleted_at is null and si.approval_status = 'recusado'), 0)::bigint as refused_cents,
       coalesce(sum(app.item_total_cents(si)) filter (where si.deleted_at is null and si.execution_status = 'executado'), 0)::bigint as executed_cents
  from service_orders so
  left join service_items si on si.service_order_id = so.id
 group by so.id;

-- Lista principal de OS (pátio, meus carros, histórico do veículo)
create or replace view v_orders as
select so.id, so.number, so.status, so.status_changed_at, so.last_activity_at, so.entry_at, so.entry_km,
       so.complaint, so.intake_notes, so.final_notes, so.completed_at, so.delivered_at, so.cancelled_reason,
       so.vehicle_id, so.customer_id, so.assigned_mechanic_id,
       v.plate, v.brand, v.model, v.version, v.year, v.color, v.engine, v.fuel,
       c.name as customer_name,
       case when app.can_read_all() then c.whatsapp end as customer_whatsapp,
       case when app.can_read_all() then c.phone end as customer_phone,
       case when app.can_read_all() then c.whatsapp_opt_in end as customer_whatsapp_opt_in,
       m.full_name as mechanic_name,
       extract(epoch from (now() - so.status_changed_at)) / 3600.0 as hours_in_status,
       extract(epoch from (now() - so.last_activity_at)) / 3600.0 as hours_since_activity,
       t.items_count, t.pending_count, t.approved_count, t.refused_count, t.executed_count,
       case when app.can_read_all() or app.is_staff() then t.total_cents end as total_cents,
       case when app.can_read_all() then t.approved_cents end as approved_cents,
       case when app.can_read_all() then t.executed_cents end as executed_cents,
       (select count(*) from service_order_checklist ch where ch.service_order_id = so.id) as checklist_total,
       (select count(*) from service_order_checklist ch where ch.service_order_id = so.id and ch.result <> 'nao_avaliado') as checklist_done,
       (select count(*) from service_order_checklist ch where ch.service_order_id = so.id and ch.result = 'necessita_reparo') as checklist_repair,
       (select count(*) from service_order_checklist ch where ch.service_order_id = so.id and ch.result = 'atencao') as checklist_attention,
       (select count(*) from media md where md.service_order_id = so.id and md.deleted_at is null) as media_count
  from service_orders so
  join vehicles v on v.id = so.vehicle_id
  join customers c on c.id = so.customer_id
  left join profiles m on m.id = so.assigned_mechanic_id
  join v_service_order_totals t on t.service_order_id = so.id
 where app.can_view_order(so.id);

-- Passagens por etapa com duração (base de "tempo em cada etapa")
create or replace view v_status_durations as
select h.service_order_id, h.to_status as status, h.changed_at as entered_at,
       lead(h.changed_at) over w as left_at,
       extract(epoch from (coalesce(lead(h.changed_at) over w, now()) - h.changed_at)) / 3600.0 as hours,
       lead(h.changed_at) over w is null as is_current,
       h.changed_by
  from service_order_status_history h
 where app.can_view_order(h.service_order_id)
window w as (partition by h.service_order_id order by h.changed_at, h.id);

-- Alertas internos (limites em settings)
create or replace view v_alerts as
with cfg as (
  select coalesce((app.setting('alert.no_update_hours') #>> '{}')::numeric, 4)            as no_update_h,
         coalesce((app.setting('alert.approval_max_hours') #>> '{}')::numeric, 24)        as approval_h,
         coalesce((app.setting('alert.waiting_part_max_hours') #>> '{}')::numeric, 72)    as part_h,
         coalesce((app.setting('alert.diagnosis_max_hours') #>> '{}')::numeric, 24)       as diag_h,
         coalesce((app.setting('alert.ready_not_notified_minutes') #>> '{}')::numeric, 30) as ready_min
), open_orders as (
  select o.* from v_orders o where o.status not in ('entregue', 'cancelada')
)
select o.id as service_order_id, o.number, o.plate, o.model, o.status, o.mechanic_name,
       'sem_atualizacao'::text as kind, 'Sem atualização há ' || floor(o.hours_since_activity) || ' h' as message,
       o.hours_since_activity as hours, 1 as severity
  from open_orders o, cfg
 where o.hours_since_activity > cfg.no_update_h
   and o.status not in ('aguardando_aprovacao', 'aguardando_peca', 'pronto_retirada')
union all
select o.id, o.number, o.plate, o.model, o.status, o.mechanic_name,
       'aguardando_aprovacao', 'Orçamento aguardando aprovação há ' || floor(o.hours_in_status) || ' h',
       o.hours_in_status, 2
  from open_orders o, cfg
 where o.status = 'aguardando_aprovacao' and o.hours_in_status > cfg.approval_h
union all
select o.id, o.number, o.plate, o.model, o.status, o.mechanic_name,
       'pronto_sem_aviso', 'Pronto para retirada e cliente ainda não avisado',
       o.hours_in_status, 3
  from open_orders o, cfg
 where o.status = 'pronto_retirada'
   and o.hours_in_status * 60 > cfg.ready_min
   and not exists (select 1 from outbound_messages om
                    where om.service_order_id = o.id
                      and om.status in ('enviada', 'entregue', 'lida')
                      and coalesce(om.sent_at, om.created_at) >= o.status_changed_at)
union all
select o.id, o.number, o.plate, o.model, o.status, o.mechanic_name,
       'aguardando_peca', 'Parado aguardando peça há ' || floor(o.hours_in_status) || ' h',
       o.hours_in_status, 2
  from open_orders o, cfg
 where o.status = 'aguardando_peca' and o.hours_in_status > cfg.part_h
union all
select o.id, o.number, o.plate, o.model, o.status, o.mechanic_name,
       'diagnostico_demorado', 'Diagnóstico acima do limite (' || floor(o.hours_in_status) || ' h)',
       o.hours_in_status, 2
  from open_orders o, cfg
 where o.status = 'em_diagnostico' and o.hours_in_status > cfg.diag_h;

-- ---------------------------------------------------------------------
-- Indicadores (gestão) — prontos para a V2; visíveis a admin e gestão
-- ---------------------------------------------------------------------
create or replace view v_kpi_orders as
select so.id, so.number, so.entry_at, so.delivered_at, so.status, so.assigned_mechanic_id, m.full_name as mechanic_name,
       t.approved_cents, t.executed_cents, t.refused_cents, t.approved_count, t.refused_count, t.executed_count,
       (select extract(epoch from (min(h2.changed_at) - min(h1.changed_at))) / 3600.0
          from service_order_status_history h1, service_order_status_history h2
         where h1.service_order_id = so.id and h1.to_status = 'em_diagnostico'
           and h2.service_order_id = so.id and h2.to_status = 'diagnostico_concluido') as diagnosis_hours,
       (select extract(epoch from (min(h2.changed_at) - min(h1.changed_at))) / 3600.0
          from service_order_status_history h1, service_order_status_history h2
         where h1.service_order_id = so.id and h1.to_status = 'aguardando_aprovacao'
           and h2.service_order_id = so.id and h2.to_status in ('servico_aprovado', 'pronto_retirada')
           and h2.changed_at > h1.changed_at) as approval_hours,
       extract(epoch from (coalesce(so.delivered_at, now()) - so.entry_at)) / 3600.0 as total_hours
  from service_orders so
  join v_service_order_totals t on t.service_order_id = so.id
  left join profiles m on m.id = so.assigned_mechanic_id
 where app.role() in ('admin', 'gestao');

-- Ações de usuário legíveis no dashboard (auditoria resumida por OS)
create or replace view v_order_timeline as
select h.service_order_id, h.changed_at as at, 'status'::text as kind,
       h.to_status::text as title, h.note as body, h.from_status::text as extra, p.full_name as actor
  from service_order_status_history h left join profiles p on p.id = h.changed_by
 where app.can_view_order(h.service_order_id)
union all
select n.service_order_id, n.created_at, case when n.is_system then 'sistema' else 'nota' end,
       null, n.body, null, p.full_name
  from service_order_notes n left join profiles p on p.id = n.author_id
 where app.can_view_order(n.service_order_id)
union all
select si.service_order_id, d.decided_at, 'decisao', d.decision::text, si.title,
       d.method::text, p.full_name
  from service_item_decisions d
  join service_items si on si.id = d.service_item_id
  left join profiles p on p.id = d.recorded_by
 where app.can_view_order(si.service_order_id)
union all
select si.service_order_id, si.executed_at, 'execucao', si.execution_status::text, si.title,
       si.execution_notes, p.full_name
  from service_items si left join profiles p on p.id = si.executed_by
 where si.executed_at is not null and si.deleted_at is null and app.can_view_order(si.service_order_id)
union all
select md.service_order_id, md.created_at, 'midia', md.kind::text, md.caption, md.id::text, p.full_name
  from media md left join profiles p on p.id = md.uploaded_by
 where md.deleted_at is null and app.can_view_order(md.service_order_id)
union all
select om.service_order_id, om.created_at, 'mensagem', om.status::text, om.rendered_body, om.provider::text, null
  from outbound_messages om
 where om.service_order_id is not null and app.can_read_all();
