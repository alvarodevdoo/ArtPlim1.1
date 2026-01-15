-- Criar views materializadas para analytics

-- View para métricas de vendas
CREATE MATERIALIZED VIEW "SalesMetrics" AS
SELECT 
  o."organizationId",
  DATE_TRUNC('day', o."createdAt") as date,
  COUNT(*) as order_count,
  SUM(o.total) as total_revenue,
  AVG(o.total) as avg_order_value,
  COUNT(CASE WHEN o.status = 'DELIVERED' THEN 1 END) as delivered_count,
  SUM(CASE WHEN o.status = 'DELIVERED' THEN o.total ELSE 0 END) as delivered_revenue
FROM "Order" o
WHERE o.status != 'CANCELLED'
GROUP BY o."organizationId", DATE_TRUNC('day', o."createdAt");

-- Índices para performance
CREATE INDEX "idx_sales_metrics_org_date" ON "SalesMetrics"("organizationId", date);

-- View para análise de custos
CREATE MATERIALIZED VIEW "CostAnalysis" AS
SELECT 
  o."organizationId",
  oi."productId",
  p.name as product_name,
  DATE_TRUNC('month', o."createdAt") as month,
  COUNT(oi.id) as item_count,
  SUM(oi.quantity) as total_quantity,
  SUM(oi."costPrice" * oi.quantity) as total_cost,
  SUM(oi."unitPrice" * oi.quantity) as total_revenue,
  SUM((oi."unitPrice" - oi."costPrice") * oi.quantity) as total_margin,
  CASE 
    WHEN SUM(oi."unitPrice" * oi.quantity) > 0 
    THEN (SUM((oi."unitPrice" - oi."costPrice") * oi.quantity) / SUM(oi."unitPrice" * oi.quantity) * 100)
    ELSE 0 
  END as avg_margin_percentage
FROM "Order" o
JOIN "OrderItem" oi ON o.id = oi."orderId"
JOIN "Product" p ON oi."productId" = p.id
WHERE o.status = 'DELIVERED'
GROUP BY o."organizationId", oi."productId", p.name, DATE_TRUNC('month', o."createdAt");

-- Índices para análise de custos
CREATE INDEX "idx_cost_analysis_org_month" ON "CostAnalysis"("organizationId", month);
CREATE INDEX "idx_cost_analysis_product" ON "CostAnalysis"("productId");

-- View para análise de materiais
CREATE MATERIALIZED VIEW "MaterialAnalysis" AS
SELECT 
  o."organizationId",
  pc."materialId",
  m.name as material_name,
  m.format as material_format,
  DATE_TRUNC('month', o."createdAt") as month,
  COUNT(oi.id) as usage_count,
  SUM(
    CASE 
      WHEN m.format = 'SHEET' THEN (oi.width * oi.height / 1000000.0) * oi.quantity
      WHEN m.format = 'ROLL' THEN (oi.width / 1000.0) * oi.quantity
      ELSE oi.quantity
    END
  ) as theoretical_consumption,
  SUM(
    CASE 
      WHEN m.format = 'SHEET' THEN (oi.width * oi.height / 1000000.0) * oi.quantity * (1 + COALESCE(pc."wastePercentage", 0) / 100.0)
      WHEN m.format = 'ROLL' THEN (oi.width / 1000.0) * oi.quantity * (1 + COALESCE(pc."wastePercentage", 0) / 100.0)
      ELSE oi.quantity * (1 + COALESCE(pc."wastePercentage", 0) / 100.0)
    END
  ) as estimated_consumption,
  AVG(COALESCE(pc."wastePercentage", 0)) as avg_waste_percentage,
  SUM(
    CASE 
      WHEN m.format = 'SHEET' THEN (oi.width * oi.height / 1000000.0) * oi.quantity * (COALESCE(pc."wastePercentage", 0) / 100.0) * m."costPerUnit"
      WHEN m.format = 'ROLL' THEN (oi.width / 1000.0) * oi.quantity * (COALESCE(pc."wastePercentage", 0) / 100.0) * m."costPerUnit"
      ELSE oi.quantity * (COALESCE(pc."wastePercentage", 0) / 100.0) * m."costPerUnit"
    END
  ) as waste_cost
FROM "Order" o
JOIN "OrderItem" oi ON o.id = oi."orderId"
JOIN "ProductComponent" pc ON oi."productId" = pc."productId"
JOIN "Material" m ON pc."materialId" = m.id
WHERE o.status IN ('IN_PRODUCTION', 'FINISHED', 'DELIVERED')
GROUP BY o."organizationId", pc."materialId", m.name, m.format, DATE_TRUNC('month', o."createdAt");

-- Índices para análise de materiais
CREATE INDEX "idx_material_analysis_org_month" ON "MaterialAnalysis"("organizationId", month);
CREATE INDEX "idx_material_analysis_material" ON "MaterialAnalysis"("materialId");

-- View para análise de produção
CREATE MATERIALIZED VIEW "ProductionMetrics" AS
SELECT 
  o."organizationId",
  DATE_TRUNC('day', o."createdAt") as date,
  COUNT(*) as total_orders,
  COUNT(CASE WHEN o.status = 'IN_PRODUCTION' THEN 1 END) as in_production_count,
  COUNT(CASE WHEN o.status = 'FINISHED' THEN 1 END) as finished_count,
  COUNT(CASE WHEN o.status = 'DELIVERED' THEN 1 END) as delivered_count,
  -- Calcular tempo médio de produção (aproximado)
  AVG(
    CASE 
      WHEN o.status = 'DELIVERED' AND o."updatedAt" > o."createdAt"
      THEN EXTRACT(EPOCH FROM (o."updatedAt" - o."createdAt")) / 3600.0 -- em horas
      ELSE NULL
    END
  ) as avg_production_time_hours
FROM "Order" o
WHERE o.status != 'CANCELLED'
GROUP BY o."organizationId", DATE_TRUNC('day', o."createdAt");

-- Índices para métricas de produção
CREATE INDEX "idx_production_metrics_org_date" ON "ProductionMetrics"("organizationId", date);

-- Tabela para configurações de relatórios
CREATE TABLE "ReportConfigurations" (
  id TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  name VARCHAR(255) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('DASHBOARD', 'COST_ANALYSIS', 'MATERIAL_ANALYTICS', 'DEMAND_FORECAST')),
  filters JSONB NOT NULL,
  schedule JSONB,
  "isPublic" BOOLEAN DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "ReportConfigurations_organizationId_fkey" 
    FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE,
  CONSTRAINT "ReportConfigurations_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
);

-- Índices para configurações de relatórios
CREATE INDEX "idx_report_configs_org_user" ON "ReportConfigurations"("organizationId", "userId");
CREATE INDEX "idx_report_configs_type" ON "ReportConfigurations"(type);

-- Tabela para cache de relatórios
CREATE TABLE "ReportCache" (
  id TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "cacheKey" VARCHAR(255) NOT NULL,
  data JSONB NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "ReportCache_organizationId_fkey" 
    FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE CASCADE
);

-- Índices para cache
CREATE INDEX "idx_report_cache_key" ON "ReportCache"("organizationId", "cacheKey");
CREATE INDEX "idx_report_cache_expires" ON "ReportCache"("expiresAt");

-- Função para refresh automático das views (executar via cron)
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY "SalesMetrics";
  REFRESH MATERIALIZED VIEW CONCURRENTLY "CostAnalysis";
  REFRESH MATERIALIZED VIEW CONCURRENTLY "MaterialAnalysis";
  REFRESH MATERIALIZED VIEW CONCURRENTLY "ProductionMetrics";
END;
$$ LANGUAGE plpgsql;