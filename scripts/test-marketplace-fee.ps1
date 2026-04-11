# Script de testing manual para Marketplace Fee (PowerShell)
# Usar desde la raíz del proyecto: .\scripts\test-marketplace-fee.ps1

Write-Host "🧪 Testing Marketplace Fee Implementation" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# Configuración
$BASE_URL = "http://localhost:3000"
$ADMIN_TOKEN = "YOUR_ADMIN_TOKEN_HERE"  # Reemplazar con token real

Write-Host ""
Write-Host "📋 Paso 1: Verificar estado inicial (sin configuración)" -ForegroundColor Yellow
Write-Host "GET $BASE_URL/app-data/marketplace-fee"
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/app-data/marketplace-fee" -Method Get
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "📋 Paso 2: Configurar marketplace fee al 5.5%" -ForegroundColor Yellow
Write-Host "POST $BASE_URL/app-data/marketplace-fee"
try {
    $headers = @{
        "Content-Type" = "application/json"
        "Authorization" = "Bearer $ADMIN_TOKEN"
    }
    $body = @{
        percentage = 5.5
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "$BASE_URL/app-data/marketplace-fee" -Method Post -Headers $headers -Body $body
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "📋 Paso 3: Verificar configuración" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/app-data/marketplace-fee" -Method Get
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "📋 Paso 4: Probar validaciones (debe fallar)" -ForegroundColor Yellow
Write-Host "POST con percentage negativo:"
try {
    $headers = @{
        "Content-Type" = "application/json"
        "Authorization" = "Bearer $ADMIN_TOKEN"
    }
    $body = @{
        percentage = -1
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "$BASE_URL/app-data/marketplace-fee" -Method Post -Headers $headers -Body $body
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Expected error: $_" -ForegroundColor Green
}

Write-Host ""
Write-Host "POST con percentage mayor a 100:"
try {
    $headers = @{
        "Content-Type" = "application/json"
        "Authorization" = "Bearer $ADMIN_TOKEN"
    }
    $body = @{
        percentage = 101
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "$BASE_URL/app-data/marketplace-fee" -Method Post -Headers $headers -Body $body
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Expected error: $_" -ForegroundColor Green
}

Write-Host ""
Write-Host "📋 Paso 5: Crear orden de prueba (subtotal: $1000)" -ForegroundColor Yellow
Write-Host "POST $BASE_URL/orders"
try {
    $headers = @{
        "Content-Type" = "application/json"
    }
    $body = @{
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
    } | ConvertTo-Json -Depth 10
    
    $response = Invoke-RestMethod -Uri "$BASE_URL/orders" -Method Post -Headers $headers -Body $body
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "📋 Paso 6: Cambiar fee a 0% y probar" -ForegroundColor Yellow
try {
    $headers = @{
        "Content-Type" = "application/json"
        "Authorization" = "Bearer $ADMIN_TOKEN"
    }
    $body = @{
        percentage = 0
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "$BASE_URL/app-data/marketplace-fee" -Method Post -Headers $headers -Body $body
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "Crear otra orden con 0% fee:"
try {
    $headers = @{
        "Content-Type" = "application/json"
    }
    $body = @{
        customerEmail = "test2@example.com"
        total = 1000
        items = @(
            @{
                name = "Producto Test 2"
                price = 1000
                quantity = 1
            }
        )
    } | ConvertTo-Json -Depth 10
    
    $response = Invoke-RestMethod -Uri "$BASE_URL/orders" -Method Post -Headers $headers -Body $body
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "📋 Paso 7: Verificar en base de datos" -ForegroundColor Yellow
Write-Host "Ejecutar en tu cliente SQL:"
Write-Host "SELECT * FROM app_data WHERE key = 'marketplace_fee_percentage';" -ForegroundColor Cyan
Write-Host "SELECT id, subtotal, marketplaceFeePercentage, marketplaceFeeAmount, total FROM orders ORDER BY createdAt DESC LIMIT 5;" -ForegroundColor Cyan

Write-Host ""
Write-Host "✅ Testing manual completado!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Casos de uso a verificar:" -ForegroundColor Yellow
Write-Host "1. ✅ Configuración inicial retorna 0%"
Write-Host "2. ✅ Configuración por admin funciona"
Write-Host "3. ✅ Validaciones de rango funcionan"
Write-Host "4. ✅ Órdenes calculan comisión correctamente"
Write-Host "5. ✅ Fee de 0% funciona correctamente"
Write-Host ""
Write-Host "🔧 Próximos pasos:" -ForegroundColor Yellow
Write-Host "- Verificar integración con MercadoPago"
Write-Host "- Probar con diferentes porcentajes"
Write-Host "- Verificar persistencia después de reinicio"
Write-Host "- Probar con montos decimales"

# Función para testear diferentes porcentajes
function Test-MarketplaceFeePercentages {
    param(
        [array]$Percentages = @(0, 2.5, 5, 7.75, 10, 15.5)
    )
    
    Write-Host ""
    Write-Host "🧮 Testing diferentes porcentajes de comisión..." -ForegroundColor Magenta
    
    foreach ($percentage in $Percentages) {
        Write-Host ""
        Write-Host "Configurando fee al $percentage%..." -ForegroundColor Cyan
        
        # Configurar el porcentaje
        try {
            $headers = @{
                "Content-Type" = "application/json"
                "Authorization" = "Bearer $ADMIN_TOKEN"
            }
            $body = @{
                percentage = $percentage
            } | ConvertTo-Json
            
            Invoke-RestMethod -Uri "$BASE_URL/app-data/marketplace-fee" -Method Post -Headers $headers -Body $body | Out-Null
            
            # Calcular valores esperados
            $subtotal = 1000
            $expectedFeeAmount = $subtotal * ($percentage / 100)
            $expectedTotal = $subtotal + $expectedFeeAmount
            
            Write-Host "Subtotal: $subtotal" -ForegroundColor White
            Write-Host "Fee ($percentage%): $expectedFeeAmount" -ForegroundColor White
            Write-Host "Total esperado: $expectedTotal" -ForegroundColor White
            
        } catch {
            Write-Host "Error configurando $percentage%: $_" -ForegroundColor Red
        }
    }
}

# Llamar la función de testing
# Test-MarketplaceFeePercentages
