# Testing rápido del Marketplace Fee
# Ejecutar línea por línea en PowerShell

$BASE_URL = "http://localhost:3000"

# 1. Verificar estado inicial
Write-Host "1. Estado inicial del marketplace fee:"
Invoke-RestMethod -Uri "$BASE_URL/app-data/marketplace-fee" -Method Get

# 2. Configurar fee al 5.5% (necesitas un token de admin válido)
$ADMIN_TOKEN = "TU_TOKEN_ADMIN_AQUI"  # Reemplazar con token real

Write-Host "`n2. Configurando marketplace fee al 5.5%:"
$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $ADMIN_TOKEN"
}
$body = @{ percentage = 5.5 } | ConvertTo-Json

try {
    $config = Invoke-RestMethod -Uri "$BASE_URL/app-data/marketplace-fee" -Method Post -Headers $headers -Body $body
    Write-Host "Configuración exitosa: $($config | ConvertTo-Json)"
} catch {
    Write-Host "Error (posiblemente token inválido): $_"
}

# 3. Verificar configuración
Write-Host "`n3. Verificando configuración:"
Invoke-RestMethod -Uri "$BASE_URL/app-data/marketplace-fee" -Method Get

# 4. Crear orden de prueba
Write-Host "`n4. Creando orden de prueba (subtotal: 1000):"
$orderHeaders = @{ "Content-Type" = "application/json" }
$orderBody = @{
    customerEmail = "test@example.com"
    customerPhone = "1234567890"
    total = 1000
    items = @(
        @{
            name = "Producto Test"
            price = 1000
            quantity = 1
        }
    )
} | ConvertTo-Json -Depth 3

try {
    $order = Invoke-RestMethod -Uri "$BASE_URL/orders" -Method Post -Headers $orderHeaders -Body $orderBody
    Write-Host "Orden creada:"
    Write-Host "- Subtotal: $($order.subtotal)"
    Write-Host "- Fee %: $($order.marketplaceFeePercentage)%"
    Write-Host "- Fee Amount: $($order.marketplaceFeeAmount)"
    Write-Host "- Total: $($order.total)"
} catch {
    Write-Host "Error creando orden: $_"
}

# 5. Probar diferentes porcentajes
$testPercentages = @(0, 2.5, 10, 15.75)
foreach ($percentage in $testPercentages) {
    Write-Host "`n5. Probando con $percentage%:"
    
    # Configurar nuevo porcentaje
    $body = @{ percentage = $percentage } | ConvertTo-Json
    try {
        Invoke-RestMethod -Uri "$BASE_URL/app-data/marketplace-fee" -Method Post -Headers $headers -Body $body | Out-Null
        
        # Mostrar cálculo esperado
        $subtotal = 1000
        $expectedFee = $subtotal * ($percentage / 100)
        $expectedTotal = $subtotal + $expectedFee
        
        Write-Host "   Configurado: $percentage%"
        Write-Host "   Para subtotal $subtotal: Fee = $$expectedFee, Total = $$expectedTotal"
        
    } catch {
        Write-Host "   Error configurando $percentage%"
    }
}
