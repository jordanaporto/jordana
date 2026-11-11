-- Dados oficiais da Injecar Auto Center (aparecem no relatório PDF; editáveis em Administração → Empresa)
update settings
   set value = value || jsonb_build_object(
         'name', 'Injecar Auto Center',
         'cnpj', '24.970.870/0001-51',
         'address', 'Rua Artur Cavalcante, 488 – Saudade I, Castanhal – PA',
         'phone', '(91) 98285-5411',
         'whatsapp', '(91) 98285-5411')
 where key = 'company';
