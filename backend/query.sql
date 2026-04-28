SELECT p.id, p.name, p.balance, count(m.id) as movements_count 
FROM profiles p 
LEFT JOIN profile_balance_movements m ON p.id = m."profileId"
WHERE p.name ILIKE '%Portuguesa%'
GROUP BY p.id, p.name, p.balance;
