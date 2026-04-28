SELECT id, name, balance FROM profiles WHERE name ILIKE '%Portuguesa%';
SELECT "orderNumber", status, "cancellationPaymentAction", "cancellationRefundAmount" FROM orders WHERE "customerId" IN (SELECT id FROM profiles WHERE name ILIKE '%Portuguesa%');
