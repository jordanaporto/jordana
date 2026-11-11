-- =====================================================================
-- Permissões: a aplicação conecta como "injecar_app" (sem BYPASSRLS, não é dona
-- das tabelas). Ela só enxerga/altera o que as políticas abaixo permitem e só
-- nas colunas liberadas. Exclusões físicas não são concedidas em nenhuma tabela.
-- =====================================================================

-- Se o banco estiver no Supabase, nada fica exposto pela API automática.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema public from anon, authenticated';
    execute 'alter default privileges in schema public revoke all on tables from anon, authenticated';
    execute 'revoke all on all functions in schema public from anon, authenticated';
  end if;
end $$;

revoke all on schema app from public;
revoke all on all tables in schema app from public;
revoke execute on all functions in schema app from public;

grant usage on schema public to injecar_app;
grant usage on schema app to injecar_app;
grant execute on all functions in schema app to injecar_app;

-- ---------------------------------------------------------------------
-- Ativa RLS em todas as tabelas de negócio
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['profiles', 'customers', 'vehicles', 'service_orders', 'service_order_status_history',
                           'service_order_notes', 'checklist_categories', 'checklist_items',
                           'service_order_checklist', 'diagnoses', 'service_items', 'service_item_decisions',
                           'media', 'message_templates', 'outbound_messages', 'reports', 'settings', 'audit_log']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from injecar_app', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- profiles: todos os usuários ativos veem a equipe; alterações só por função de admin
-- ---------------------------------------------------------------------
grant select on profiles to injecar_app;
create policy profiles_read on profiles for select to injecar_app using (app.role() is not null);

-- ---------------------------------------------------------------------
-- clientes
-- ---------------------------------------------------------------------
grant select on customers to injecar_app;
grant insert (name, phone, whatsapp, cpf, notes, whatsapp_opt_in) on customers to injecar_app;
grant update (name, phone, whatsapp, cpf, notes, whatsapp_opt_in) on customers to injecar_app;
create policy customers_read on customers for select to injecar_app using (app.can_read_all());
create policy customers_insert on customers for insert to injecar_app with check (app.is_staff());
create policy customers_update on customers for update to injecar_app
  using (app.is_staff() and anonymized_at is null) with check (app.is_staff());

-- ---------------------------------------------------------------------
-- veículos
-- ---------------------------------------------------------------------
grant select on vehicles to injecar_app;
grant insert (customer_id, plate, brand, model, version, year, engine, fuel, current_km, color, notes) on vehicles to injecar_app;
grant update (customer_id, plate, brand, model, version, year, engine, fuel, current_km, color, notes) on vehicles to injecar_app;
create policy vehicles_read on vehicles for select to injecar_app using (app.can_view_vehicle(id));
create policy vehicles_insert on vehicles for insert to injecar_app with check (app.is_staff());
create policy vehicles_update on vehicles for update to injecar_app using (app.is_staff()) with check (app.is_staff());

-- ---------------------------------------------------------------------
-- OS e histórico: leitura conforme visibilidade; escrita só por funções
-- ---------------------------------------------------------------------
grant select on service_orders, service_order_status_history to injecar_app;
create policy so_read on service_orders for select to injecar_app using (app.can_view_order(id));
create policy so_history_read on service_order_status_history for select to injecar_app
  using (app.can_view_order(service_order_id));

grant select on service_order_notes to injecar_app;
grant insert (service_order_id, body) on service_order_notes to injecar_app;
create policy notes_read on service_order_notes for select to injecar_app using (app.can_view_order(service_order_id));
create policy notes_insert on service_order_notes for insert to injecar_app
  with check (app.can_edit_order(service_order_id) and not is_system);

-- ---------------------------------------------------------------------
-- checklist (modelo: admin; preenchimento: quem edita a OS)
-- ---------------------------------------------------------------------
grant select on checklist_categories, checklist_items to injecar_app;
grant insert (name, position, active) on checklist_categories to injecar_app;
grant update (name, position, active) on checklist_categories to injecar_app;
grant insert (category_id, name, position, active) on checklist_items to injecar_app;
grant update (category_id, name, position, active) on checklist_items to injecar_app;
create policy cl_cat_read on checklist_categories for select to injecar_app using (app.role() is not null);
create policy cl_cat_insert on checklist_categories for insert to injecar_app with check (app.is_admin());
create policy cl_cat_update on checklist_categories for update to injecar_app using (app.is_admin()) with check (app.is_admin());
create policy cl_item_read on checklist_items for select to injecar_app using (app.role() is not null);
create policy cl_item_insert on checklist_items for insert to injecar_app with check (app.is_admin());
create policy cl_item_update on checklist_items for update to injecar_app using (app.is_admin()) with check (app.is_admin());

grant select on service_order_checklist to injecar_app;
grant update (result, note) on service_order_checklist to injecar_app;
create policy so_cl_read on service_order_checklist for select to injecar_app using (app.can_view_order(service_order_id));
create policy so_cl_update on service_order_checklist for update to injecar_app
  using (app.can_edit_order(service_order_id)) with check (app.can_edit_order(service_order_id));

-- ---------------------------------------------------------------------
-- diagnóstico
-- ---------------------------------------------------------------------
grant select on diagnoses to injecar_app;
grant insert (service_order_id, reported_symptom, tests_performed, results, root_cause, components, recommendation, technical_notes)
  on diagnoses to injecar_app;
grant update (reported_symptom, tests_performed, results, root_cause, components, recommendation, technical_notes)
  on diagnoses to injecar_app;
create policy diag_read on diagnoses for select to injecar_app using (app.can_view_order(service_order_id));
create policy diag_insert on diagnoses for insert to injecar_app with check (app.can_edit_order(service_order_id));
create policy diag_update on diagnoses for update to injecar_app
  using (app.can_edit_order(service_order_id)) with check (app.can_edit_order(service_order_id));

-- ---------------------------------------------------------------------
-- serviços (aprovação/execução/remoção só por função)
-- ---------------------------------------------------------------------
grant select on service_items, service_item_decisions to injecar_app;
grant insert (service_order_id, title, description, part_name, quantity, part_unit_price_cents, labor_price_cents, priority)
  on service_items to injecar_app;
grant update (title, description, part_name, quantity, part_unit_price_cents, labor_price_cents, priority)
  on service_items to injecar_app;
create policy items_read on service_items for select to injecar_app using (app.can_view_order(service_order_id));
create policy items_insert on service_items for insert to injecar_app
  with check (app.role() in ('mecanico', 'atendimento', 'admin') and app.can_edit_order(service_order_id));
create policy items_update on service_items for update to injecar_app
  using (app.can_edit_order(service_order_id) and deleted_at is null)
  with check (app.can_edit_order(service_order_id));
create policy decisions_read on service_item_decisions for select to injecar_app
  using (exists (select 1 from service_items si where si.id = service_item_id and app.can_view_order(si.service_order_id)));

-- ---------------------------------------------------------------------
-- mídia (exclusão lógica só por função de admin)
-- ---------------------------------------------------------------------
grant select on media to injecar_app;
grant insert (service_order_id, checklist_entry_id, diagnosis_id, service_item_id, kind, storage_path, thumb_path,
              mime_type, size_bytes, duration_seconds, caption) on media to injecar_app;
grant update (caption, include_in_report, checklist_entry_id, diagnosis_id, service_item_id) on media to injecar_app;
create policy media_read on media for select to injecar_app using (app.can_view_order(service_order_id));
create policy media_insert on media for insert to injecar_app with check (app.can_edit_order(service_order_id));
create policy media_update on media for update to injecar_app
  using (app.can_edit_order(service_order_id) and deleted_at is null)
  with check (app.can_edit_order(service_order_id));

-- ---------------------------------------------------------------------
-- mensagens
-- ---------------------------------------------------------------------
grant select on message_templates to injecar_app;
grant insert (trigger_status, name, body, meta_template_name, meta_language, meta_variables, active) on message_templates to injecar_app;
grant update (trigger_status, name, body, meta_template_name, meta_language, meta_variables, active) on message_templates to injecar_app;
create policy tpl_read on message_templates for select to injecar_app using (app.can_read_all());
create policy tpl_insert on message_templates for insert to injecar_app with check (app.is_admin());
create policy tpl_update on message_templates for update to injecar_app using (app.is_admin()) with check (app.is_admin());

grant select on outbound_messages to injecar_app;
create policy outbound_read on outbound_messages for select to injecar_app using (app.can_read_all());

-- ---------------------------------------------------------------------
-- relatórios, configurações, auditoria
-- ---------------------------------------------------------------------
grant select on reports to injecar_app;
create policy reports_read on reports for select to injecar_app using (app.can_read_all() and app.can_view_order(service_order_id));

grant select on settings to injecar_app;
grant insert (key, value) on settings to injecar_app;
grant update (value) on settings to injecar_app;
create policy settings_read on settings for select to injecar_app using (app.role() is not null);
create policy settings_insert on settings for insert to injecar_app with check (app.is_admin());
create policy settings_update on settings for update to injecar_app using (app.is_admin()) with check (app.is_admin());

grant select on audit_log to injecar_app;
create policy audit_read on audit_log for select to injecar_app using (app.is_admin());

-- ---------------------------------------------------------------------
-- views
-- ---------------------------------------------------------------------
grant select on v_service_order_totals, v_orders, v_status_durations, v_alerts, v_kpi_orders, v_order_timeline
  to injecar_app;
-- v_service_order_totals não filtra sozinha: só é lida pela aplicação junto de v_orders
revoke select on v_service_order_totals from injecar_app;
