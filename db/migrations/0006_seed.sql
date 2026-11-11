-- =====================================================================
-- Dados de referência iniciais (editáveis depois pelo administrador)
-- =====================================================================

-- Checklist do briefing
with cats(name, position, items) as (
  values
    ('Pneus', 1, array['Dianteiro esquerdo', 'Dianteiro direito', 'Traseiro esquerdo', 'Traseiro direito', 'Estepe']),
    ('Freios', 2, array['Pastilhas', 'Discos', 'Fluido', 'Sistema traseiro']),
    ('Suspensão e direção', 3, array['Amortecedores', 'Bieletas', 'Buchas', 'Pivôs', 'Terminais', 'Caixa de direção']),
    ('Motor', 4, array['Nível e condição do óleo', 'Vazamentos', 'Correias', 'Ruídos', 'Filtros']),
    ('Sistema de arrefecimento', 5, array['Nível', 'Reservatório', 'Mangueiras', 'Vazamentos', 'Ventoinha']),
    ('Iluminação', 6, array['Faróis', 'Lanternas', 'Setas', 'Luz de freio', 'Luz de ré']),
    ('Outros', 7, array['Bateria', 'Limpadores', 'Ar-condicionado', 'Observações gerais'])
), ins as (
  insert into checklist_categories (name, position)
  select name, position from cats
  returning id, name
)
insert into checklist_items (category_id, name, position)
select ins.id, item.name, item.ord
  from ins
  join cats on cats.name = ins.name
  cross join lateral unnest(cats.items) with ordinality as item(name, ord);

-- Mensagens automáticas por etapa
insert into message_templates (trigger_status, name, body, meta_template_name, meta_variables, active) values
  ('recebido', 'Veículo recebido',
   'Olá, {nome}. Seu {modelo} foi recebido pela equipe da Injecar e já entrou em nosso fluxo de atendimento. Vamos mantendo você atualizado por aqui.',
   null, array['nome', 'modelo'], true),
  ('em_diagnostico', 'Em diagnóstico',
   'Seu veículo já está com nossa equipe técnica e estamos realizando os testes necessários para identificar o problema.',
   null, array[]::text[], true),
  ('aguardando_aprovacao', 'Aguardando aprovação',
   'Concluímos a avaliação do seu veículo. Encontramos alguns itens que precisam da sua atenção. Confira o diagnóstico e os serviços recomendados.',
   null, array[]::text[], true),
  ('em_manutencao', 'Serviço iniciado',
   'Os serviços aprovados no seu veículo já foram iniciados.',
   null, array[]::text[], true),
  ('pronto_retirada', 'Pronto para retirada',
   'Seu veículo está pronto. Os serviços foram concluídos e realizamos a verificação final.',
   null, array[]::text[], true),
  ('entregue', 'Agradecimento pela visita',
   'Obrigado pela confiança, {nome}! Qualquer dúvida sobre o serviço do seu {modelo}, é só chamar por aqui. Injecar. Aqui, nós resolvemos.',
   null, array['nome', 'modelo'], false);

-- Configurações padrão
insert into settings (key, value) values
  ('alert.no_update_hours', '4'),
  ('alert.approval_max_hours', '24'),
  ('alert.waiting_part_max_hours', '72'),
  ('alert.diagnosis_max_hours', '24'),
  ('alert.ready_not_notified_minutes', '30'),
  ('messaging.provider', '"manual"'),
  ('company', '{"name": "Injecar Auto Center", "legal_name": "", "cnpj": "", "address": "Castanhal - PA", "phone": "", "whatsapp": ""}');
