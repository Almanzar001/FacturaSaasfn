-- Ver configuración de inventario
SELECT 
    inventory_enabled,
    auto_deduct_on_invoice,
    require_stock_validation,
    low_stock_threshold
FROM inventory_settings
WHERE organization_id = (
    SELECT organization_id 
    FROM products 
    WHERE name = 'Liquido Naranja 50ml' 
    LIMIT 1
);