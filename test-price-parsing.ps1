# Test para verificar que price y discountPrice se parseen correctamente
Write-Host "=== Testing Price Parsing Fix ===" -ForegroundColor Cyan

# Obtener token
Write-Host "1. Getting token..." -ForegroundColor Yellow
$loginBody = @{
    email = "test@example.com"
    password = "password123"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "http://localhost:3001/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
    $token = $loginResponse.access_token
    Write-Host "✓ Token obtained" -ForegroundColor Green
} catch {
    Write-Host "✗ Login failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Crear catálogo
Write-Host "`n2. Creating test catalog..." -ForegroundColor Yellow
$catalogBody = @{
    catalogType = "MENU"
    name = "Test Catalog for Price Fix"
} | ConvertTo-Json

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

try {
    $catalogResponse = Invoke-RestMethod -Uri "http://localhost:3001/catalogs" -Method POST -Body $catalogBody -Headers $headers
    $catalogId = $catalogResponse.id
    Write-Host "✓ Catalog created: $catalogId" -ForegroundColor Green
} catch {
    Write-Host "✗ Catalog creation failed, using existing ID..." -ForegroundColor Yellow
    $catalogId = "66de5caa-f49b-4c17-a3b0-fe6fd34cea2e"
}

# Test con diferentes tipos de precios
Write-Host "`n3. Testing price parsing with different values..." -ForegroundColor Yellow

$testCases = @(
    @{
        name = "Test Integer Price"
        price = 15
        discountPrice = 12
        expected = "15 (number), 12 (number)"
    },
    @{
        name = "Test Float Price" 
        price = 15.50
        discountPrice = 12.99
        expected = "15.50 (number), 12.99 (number)"
    },
    @{
        name = "Test String Price"
        price = "20.75"
        discountPrice = "18.50"
        expected = "20.75 (number), 18.50 (number)"
    }
)

$testCount = 0
foreach ($testCase in $testCases) {
    $testCount++
    Write-Host "`n   Test $testCount - $($testCase.name)" -ForegroundColor Yellow
    
    $itemBody = @{
        name = $testCase.name
        description = "Testing price conversion"
        price = $testCase.price
        discountPrice = $testCase.discountPrice
        attributes = @{}
    } | ConvertTo-Json -Depth 3

    try {
        $itemResponse = Invoke-RestMethod -Uri "http://localhost:3001/catalogs/$catalogId/items" -Method POST -Body $itemBody -Headers $headers
        
        $priceType = $itemResponse.price.GetType().Name
        $discountType = if ($itemResponse.discountPrice -ne $null) { $itemResponse.discountPrice.GetType().Name } else { "null" }
        
        Write-Host "   ✓ Created: $($itemResponse.name)" -ForegroundColor Green
        Write-Host "   Price: $($itemResponse.price) ($priceType)" -ForegroundColor Gray
        Write-Host "   DiscountPrice: $($itemResponse.discountPrice) ($discountType)" -ForegroundColor Gray
        Write-Host "   AverageRating: $($itemResponse.averageRating) ($($itemResponse.averageRating.GetType().Name))" -ForegroundColor Gray
        
        # Verificar que son números
        if ($priceType -eq "Double" -or $priceType -eq "Int32") {
            Write-Host "   ✓ Price is numeric type" -ForegroundColor Green
        } else {
            Write-Host "   ✗ Price is still string!" -ForegroundColor Red
        }
        
        if ($discountType -eq "Double" -or $discountType -eq "Int32" -or $discountType -eq "null") {
            Write-Host "   ✓ DiscountPrice is correct type" -ForegroundColor Green
        } else {
            Write-Host "   ✗ DiscountPrice is still string!" -ForegroundColor Red
        }
        
    } catch {
        Write-Host "   ✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n=== Test completed ===" -ForegroundColor Cyan
Write-Host "If prices are still showing as strings, the server needs to be restarted" -ForegroundColor Yellow
Write-Host "to apply the entity transformer changes." -ForegroundColor Yellow