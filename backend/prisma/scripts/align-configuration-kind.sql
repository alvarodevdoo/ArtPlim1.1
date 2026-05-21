-- ─────────────────────────────────────────────────────────────────────────
-- Alinhamento de ConfigurationKind para grupos existentes (Fase 1.5)
-- ─────────────────────────────────────────────────────────────────────────
--
-- Contexto: a Fase 1.5 adicionou o campo `kind` a `product_configurations`
-- com default VARIATION. Para grupos legados cujo NOME indica acabamento
-- (ex: "Acabamento", "Extras", "Acessórios"), atualizamos para FINISHING
-- numa única passada — assim a fonte de verdade no banco fica correta
-- e o fallback heurístico de nome no frontend deixa de ser necessário.
--
-- USO: rode uma única vez via psql ou via:
--   pnpm prisma db execute --file prisma/scripts/align-configuration-kind.sql
--
-- IDEMPOTENTE: pode rodar várias vezes sem efeitos colaterais (apenas troca
-- grupos com nome casando E ainda marcados como VARIATION).
-- ─────────────────────────────────────────────────────────────────────────

UPDATE product_configurations
SET kind = 'FINISHING',
    "updatedAt" = NOW()
WHERE kind = 'VARIATION'
  AND (
    LOWER(name) LIKE '%acabamento%'
    OR LOWER(name) LIKE '%acabamentos%'
    OR LOWER(name) LIKE '%acessório%'
    OR LOWER(name) LIKE '%acessorio%'
    OR LOWER(name) LIKE '%acessórios%'
    OR LOWER(name) LIKE '%acessorios%'
    OR LOWER(name) LIKE '%extras%'
    OR LOWER(name) LIKE '%extra%'
    OR LOWER(name) LIKE '%adicional%'
    OR LOWER(name) LIKE '%adicionais%'
    OR LOWER(name) LIKE '%opcional%'
    OR LOWER(name) LIKE '%opcionais%'
    OR LOWER(name) LIKE '%complementar%'
    OR LOWER(name) LIKE '%complementares%'
  );

-- Conferência: mostra a contagem por kind após o ajuste
SELECT kind, COUNT(*) AS total
FROM product_configurations
GROUP BY kind
ORDER BY kind;
