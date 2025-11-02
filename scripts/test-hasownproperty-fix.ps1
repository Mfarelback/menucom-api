# Test simple para verificar fix de hasOwnProperty
# PowerShell script sin caracteres especiales

param(
    [string]$BaseUrl = "http://localhost:3000"
)

Write-Host "=== Testing hasOwnProperty Fix ===" -ForegroundColor Cyan
Write-Host ""

# Test de autenticacion
Write-Host "1. Authenticating..." -ForegroundColor Blue
$authBody = @{
    email = "admin@username.com"
    password = "password"
} | ConvertTo-Json

try {
    $authResponse = Invoke-RestMethod -Uri "$BaseUrl/auth/login" -Method POST -Body $authBody -ContentType "application/json"
    $token = $authResponse.access_token
    Write-Host "   SUCCESS: Got token" -ForegroundColor Green
}
catch {
    Write-Host "   ERROR: Authentication failed - $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Headers con token
$headers = @{ Authorization = "Bearer $token" }

# Test: Crear catalogo
Write-Host "2. Creating test catalog..." -ForegroundColor Blue
$catalogData = @{
    catalogType = "MENU"
    name = "Test Catalog for hasOwnProperty Fix"
    description = "Testing update functionality"
    isPublic = $true
} | ConvertTo-Json

try {
    $catalogResponse = Invoke-RestMethod -Uri "$BaseUrl/catalogs" -Method POST -Headers $headers -Body $catalogData -ContentType "application/json"
    $catalogId = $catalogResponse.id
    Write-Host "   SUCCESS: Catalog created with ID: $catalogId" -ForegroundColor Green
}
catch {
    Write-Host "   ERROR: Catalog creation failed - $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test: Actualizar catalogo (esto deberia usar el slug check que tenia hasOwnProperty)
Write-Host "3. Updating catalog (testing hasOwnProperty fix)..." -ForegroundColor Blue
$updateData = @{
    name = "Updated Test Catalog"
    description = "Updated description"
    slug = "updated-test-catalog"
} | ConvertTo-Json

try {
    $updateResponse = Invoke-RestMethod -Uri "$BaseUrl/catalogs/$catalogId" -Method PUT -Headers $headers -Body $updateData -ContentType "application/json"
    Write-Host "   SUCCESS: Catalog updated successfully" -ForegroundColor Green
    Write-Host "   Updated name: $($updateResponse.name)" -ForegroundColor Cyan
}
catch {
    Write-Host "   ERROR: Catalog update failed - $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   This might indicate the hasOwnProperty issue is still present" -ForegroundColor Yellow
    exit 1
}

# Test: Actualizar sin slug (deberia funcionar sin problemas)
Write-Host "4. Updating catalog without slug..." -ForegroundColor Blue
$updateData2 = @{
    name = "Final Updated Test Catalog"
    description = "Final updated description"
} | ConvertTo-Json

try {
    $updateResponse2 = Invoke-RestMethod -Uri "$BaseUrl/catalogs/$catalogId" -Method PUT -Headers $headers -Body $updateData2 -ContentType "application/json"
    Write-Host "   SUCCESS: Catalog updated without slug" -ForegroundColor Green
    Write-Host "   Final name: $($updateResponse2.name)" -ForegroundColor Cyan
}
catch {
    Write-Host "   ERROR: Catalog update without slug failed - $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Cleanup: Eliminar catalogo de test
Write-Host "5. Cleaning up test catalog..." -ForegroundColor Blue
try {
    Invoke-RestMethod -Uri "$BaseUrl/catalogs/$catalogId" -Method DELETE -Headers $headers
    Write-Host "   SUCCESS: Test catalog deleted" -ForegroundColor Green
}
catch {
    Write-Host "   WARNING: Could not delete test catalog - $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== All Tests Passed! hasOwnProperty fix is working ===" -ForegroundColor Green
Write-Host ""