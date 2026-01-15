-- Criar produto especial para itens de serviço
INSERT INTO products (
  id,
  organization_id,
  name,
  description,
  pricing_mode,
  sale_price,
  min_price,
  is_active,
  created_at,
  updated_at
) VALUES (
  'service-default-product',
  '2950ba95-64f6-4555-b344-3893181c70ba',
  'Serviço Genérico',
  'Produto especial para itens de serviço que não requerem produto físico',
  'SIMPLE_UNIT',
  0.00,
  0.00,
  true,
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;