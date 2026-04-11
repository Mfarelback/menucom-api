# Script para debuggear la creación de catálogo
$baseUrl = "http://localhost:3001"
$email = "test@example.com"
$password = "password123"

Write-Host "=== Debugging Catalog Creation ===" -ForegroundColor Cyan

# Paso 1: Autenticación
Write-Host "1. Autenticando usuario..." -ForegroundColor Yellow
$loginBody = @{
    email = $email
    password = $password
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
    $token = $loginResponse.access_token
    Write-Host "✓ Autenticación exitosa" -ForegroundColor Green
    Write-Host "Token: $($token.Substring(0, 20))..." -ForegroundColor Gray
} catch {
    Write-Host "✗ Error en autenticación: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Paso 2: Crear catálogo con datos mínimos
Write-Host "`n2. Creando catálogo con datos mínimos..." -ForegroundColor Yellow
$catalogBody = @{
    catalogType = "MENU"
    name = "Debug Test Catalog"
} | ConvertTo-Json

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

try {
    Write-Host "Enviando request a: $baseUrl/catalogs" -ForegroundColor Gray
    Write-Host "Headers: Authorization Bearer [token...]" -ForegroundColor Gray
    Write-Host "Body: $catalogBody" -ForegroundColor Gray
    
    $catalogResponse = Invoke-RestMethod -Uri "$baseUrl/catalogs" -Method POST -Body $catalogBody -Headers $headers
    Write-Host "✓ Catálogo creado exitosamente" -ForegroundColor Green
    Write-Host "Catalog ID: $($catalogResponse.id)" -ForegroundColor Gray
    
} catch {
    Write-Host "✗ Error creando catálogo:" -ForegroundColor Red
    Write-Host "Status Code: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    Write-Host "Error Message: $($_.Exception.Message)" -ForegroundColor Red
    
    # Intentar obtener más detalles del error
    if ($_.Exception.Response) {
        try {
            $errorStream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($errorStream)
            $errorBody = $reader.ReadToEnd()
            Write-Host "Error Details: $errorBody" -ForegroundColor Red
        } catch {
            Write-Host "No se pudieron obtener detalles adicionales del error" -ForegroundColor Red
        }
    }
}

Write-Host "`n=== Debug Complete ===" -ForegroundColor Cyan