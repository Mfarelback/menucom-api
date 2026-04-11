# Test de creación de items de catálogo
Write-Host "=== Testing Catalog Item Creation ===" -ForegroundColor Cyan

# Paso 1: Obtener token
Write-Host "`n1. Getting JWT token..." -ForegroundColor Yellow

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

# Paso 2: Crear catálogo si no existe
Write-Host "`n2. Creating test catalog..." -ForegroundColor Yellow

$catalogBody = @{
    catalogType = "MENU"
    name = "Test Catalog for Items"
} | ConvertTo-Json

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

try {
    $catalogResponse = Invoke-RestMethod -Uri "http://localhost:3001/catalogs" -Method POST -Body $catalogBody -Headers $headers
    $catalogId = $catalogResponse.id
    Write-Host "✓ Catalog created with ID: $catalogId" -ForegroundColor Green
} catch {
    Write-Host "Using existing catalog ID from your curl..." -ForegroundColor Yellow
    $catalogId = "66de5caa-f49b-4c17-a3b0-fe6fd34cea2e"
}

# Paso 3: Test crear item usando JSON (más simple)
Write-Host "`n3. Testing item creation with JSON..." -ForegroundColor Yellow

$itemBody = @{
    name = "Item prueba JSON"
    description = "Item de prueba usando JSON"
    price = 12
    discountPrice = 11
    isAvailable = $true
    attributes = @{
        ingredients = @("tomate", "queso")
        category = "food"
    }
} | ConvertTo-Json -Depth 3

try {
    $itemResponse = Invoke-RestMethod -Uri "http://localhost:3001/catalogs/$catalogId/items" -Method POST -Body $itemBody -Headers $headers
    Write-Host "✓ Item created successfully with JSON!" -ForegroundColor Green
    Write-Host "   Item ID: $($itemResponse.id)" -ForegroundColor Gray
    Write-Host "   Item name: $($itemResponse.name)" -ForegroundColor Gray
} catch {
    Write-Host "✗ JSON creation failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $errorStream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($errorStream)
        $errorBody = $reader.ReadToEnd()
        Write-Host "Error details: $errorBody" -ForegroundColor Red
    }
}

Write-Host "`n=== Test completed ===" -ForegroundColor Cyan

# Mostrar ejemplos de curl corregidos
Write-Host "`n=== CORRECTED CURL EXAMPLES ===" -ForegroundColor Cyan

Write-Host "`n# Opción 1: JSON simple (recomendado)" -ForegroundColor White
Write-Host "curl -X POST \\" -ForegroundColor Gray
Write-Host "  -H 'Content-Type: application/json' \\" -ForegroundColor Gray
Write-Host "  -H 'Authorization: Bearer YOUR_TOKEN' \\" -ForegroundColor Gray
Write-Host "  -d '{" -ForegroundColor Gray
Write-Host '    "name": "Item prueba",' -ForegroundColor Gray
Write-Host '    "description": "Item de prueba",' -ForegroundColor Gray
Write-Host '    "price": 12,' -ForegroundColor Gray
Write-Host '    "discountPrice": 11,' -ForegroundColor Gray
Write-Host '    "isAvailable": true,' -ForegroundColor Gray
Write-Host '    "attributes": {"ingredients": ["tomate", "queso"]}' -ForegroundColor Gray
Write-Host "  }' \\" -ForegroundColor Gray
Write-Host "  http://localhost:3001/catalogs/CATALOG_ID/items" -ForegroundColor Gray

Write-Host "`n# Opción 2: Form-data (si necesitas subir imagen)" -ForegroundColor White
Write-Host "curl -X POST \\" -ForegroundColor Gray
Write-Host "  -H 'Authorization: Bearer YOUR_TOKEN' \\" -ForegroundColor Gray
Write-Host "  -F 'name=Item prueba' \\" -ForegroundColor Gray
Write-Host "  -F 'description=Item de prueba' \\" -ForegroundColor Gray
Write-Host "  -F 'price=12' \\" -ForegroundColor Gray
Write-Host "  -F 'discountPrice=11' \\" -ForegroundColor Gray
Write-Host "  -F 'isAvailable=true' \\" -ForegroundColor Gray
Write-Host "  -F 'attributes={}' \\" -ForegroundColor Gray
Write-Host "  -F 'photo=@/path/to/image.jpg' \\" -ForegroundColor Gray
Write-Host "  http://localhost:3001/catalogs/CATALOG_ID/items" -ForegroundColor Gray

Write-Host "`n# Nota: Para form-data, usa attributes='{}' para vacío" -ForegroundColor Yellow
Write-Host "# o attributes='{\"key\": \"value\"}' para datos específicos" -ForegroundColor Yellow