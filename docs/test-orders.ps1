# Test Orders API
Write-Host "🔍 Testing Orders API..." -ForegroundColor Green

try {
    # Login to get token
    Write-Host "1. Logging in..." -ForegroundColor Yellow
    $loginBody = @{
        email = "admin@nartplim.com"
        password = "admin123"
    } | ConvertTo-Json

    $loginResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
    $token = $loginResponse.data.token
    Write-Host "✅ Login successful" -ForegroundColor Green

    # Test orders endpoint
    Write-Host "2. Fetching orders..." -ForegroundColor Yellow
    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    }

    $ordersResponse = Invoke-RestMethod -Uri "http://localhost:3001/api/sales/orders" -Method Get -Headers $headers
    
    Write-Host "📊 Orders API Response:" -ForegroundColor Cyan
    Write-Host "Success: $($ordersResponse.success)" -ForegroundColor White
    Write-Host "Orders Count: $($ordersResponse.data.Count)" -ForegroundColor White
    
    if ($ordersResponse.data.Count -gt 0) {
        $firstOrder = $ordersResponse.data[0]
        Write-Host "`n📋 First Order Details:" -ForegroundColor Cyan
        Write-Host "Order Number: $($firstOrder.orderNumber)" -ForegroundColor White
        Write-Host "Customer: $($firstOrder.customer.name)" -ForegroundColor White
        Write-Host "Items Count: $($firstOrder.items.Count)" -ForegroundColor White
        Write-Host "Total: $($firstOrder.total)" -ForegroundColor White
        
        if ($firstOrder.items.Count -gt 0) {
            $firstItem = $firstOrder.items[0]
            Write-Host "`n🛍️ First Item Details:" -ForegroundColor Cyan
            Write-Host "Product ID: $($firstItem.productId)" -ForegroundColor White
            Write-Host "Product Name: $($firstItem.product.name)" -ForegroundColor White
            Write-Host "Product Pricing Mode: $($firstItem.product.pricingMode)" -ForegroundColor White
            Write-Host "Quantity: $($firstItem.quantity)" -ForegroundColor White
            Write-Host "Unit Price: $($firstItem.unitPrice)" -ForegroundColor White
            Write-Host "Total Price: $($firstItem.totalPrice)" -ForegroundColor White
        }
        
        # Show full JSON structure for debugging
        Write-Host "`n📄 Full Response Structure:" -ForegroundColor Cyan
        $ordersResponse | ConvertTo-Json -Depth 10 | Write-Host
    } else {
        Write-Host "⚠️ No orders found in the system" -ForegroundColor Yellow
    }

} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        Write-Host "Status Code: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    }
}