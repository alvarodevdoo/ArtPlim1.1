Write-Host "Testing Orders API..." -ForegroundColor Green

try {
    # Login
    $loginBody = '{"email":"admin@nartplim.com","password":"admin123"}'
    $loginResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
    $token = $loginResponse.data.token
    Write-Host "Login successful" -ForegroundColor Green

    # Get orders
    $headers = @{"Authorization" = "Bearer $token"; "Content-Type" = "application/json"}
    $ordersResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/sales/orders" -Method Get -Headers $headers
    
    Write-Host "Orders Count: $($ordersResponse.data.Count)" -ForegroundColor White
    
    if ($ordersResponse.data.Count -gt 0) {
        $firstOrder = $ordersResponse.data[0]
        Write-Host "First Order: $($firstOrder.orderNumber)" -ForegroundColor White
        Write-Host "Customer: $($firstOrder.customer.name)" -ForegroundColor White
        Write-Host "Items: $($firstOrder.items.Count)" -ForegroundColor White
        
        if ($firstOrder.items.Count -gt 0) {
            $firstItem = $firstOrder.items[0]
            Write-Host "First Item Product: $($firstItem.product.name)" -ForegroundColor White
        }
    } else {
        Write-Host "No orders found" -ForegroundColor Yellow
    }

} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}