SELECT p.name as product_name, cg.name as "group_name", co.label as option_label 
FROM products p
JOIN product_configurations cg ON cg."productId" = p.id
JOIN configuration_options co ON co."configurationId" = cg.id
WHERE p.name = 'teste';
