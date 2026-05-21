-- Migration: add_order_sequence_table
-- Substitui o advisory lock + MAX() por um contador atômico por organização.
-- UPDATE ... RETURNING no PostgreSQL é intrinsecamente atômico — sem lock manual.

CREATE TABLE "order_sequences" (
  "organizationId" TEXT NOT NULL,
  "lastValue"      INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "order_sequences_pkey" PRIMARY KEY ("organizationId"),
  CONSTRAINT "order_sequences_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE
);

-- Seed: popula com o maior número de pedido já existente por organização,
-- garantindo que a sequência continue de onde parou sem colisões.
INSERT INTO "order_sequences" ("organizationId", "lastValue")
SELECT
  "organizationId",
  COALESCE(
    MAX(CAST(SUBSTRING("orderNumber" FROM '(\d+)$') AS INTEGER)),
    0
  )
FROM "orders"
GROUP BY "organizationId"
ON CONFLICT DO NOTHING;
