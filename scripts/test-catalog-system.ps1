# Script de Testing Automatizado para Sistema de Catálogos MenuCom (PowerShell)
# Autor: Sistema de Refactorización MenuCom
# Fecha: 2025-10-10

param(
    [string]$BaseUrl = "http://localhost:3000",
    [string]$Email = "admin@username.com",
    [string]$Password = "password"
)

# Configuración
$Global:ApiUrl = $BaseUrl
$Global:Token = ""
$Global:TestResults = @()

# Funciones de utilidad
function Write-Status {
    param(
        [string]$Status,
        [string]$Message
    )
    
    switch ($Status) {
        "SUCCESS" { Write-Host "✅ SUCCESS: $Message" -ForegroundColor Green }
        "ERROR" { Write-Host "❌ ERROR: $Message" -ForegroundColor Red }
        "INFO" { Write-Host "ℹ️  INFO: $Message" -ForegroundColor Blue }
        "WARNING" { Write-Host "⚠️  WARNING: $Message" -ForegroundColor Yellow }
    }
}

function Invoke-ApiRequest {
    param(
        [string]$Method,
        [string]$Endpoint,
        [hashtable]$Headers = @{},
        [object]$Body = $null,
        [string]$ContentType = "application/json"
    )
    
    Write-Status "INFO" "Testing: $Method $Endpoint"
    
    $uri = "$Global:ApiUrl$Endpoint"
    $requestParams = @{
        Uri = $uri
        Method = $Method
        Headers = $Headers
    }
    
    if ($Body) {
        if ($ContentType -eq "application/json") {
            $requestParams.Body = $Body | ConvertTo-Json -Depth 10
        } else {
            $requestParams.Body = $Body
        }
        $requestParams.ContentType = $ContentType
    }
    
    try {
        $response = Invoke-RestMethod @requestParams
        Write-Status "SUCCESS" "$Method $Endpoint - Success"
        return @{ Success = $true; Data = $response }
    }
    catch {
        $errorDetail = $_.Exception.Message
        Write-Status "ERROR" "$Method $Endpoint - $errorDetail"
        return @{ Success = $false; Error = $errorDetail }
    }
}

# Test: Autenticación
function Test-Authentication {
    Write-Status "INFO" "Authenticating user..."
    
    $authBody = @{
        email = $Email
        password = $Password
    }
    
    $result = Invoke-ApiRequest -Method "POST" -Endpoint "/auth/login" -Body $authBody
    
    if ($result.Success -and $result.Data.access_token) {
        $Global:Token = $result.Data.access_token
        Write-Status "SUCCESS" "Authentication successful"
        return $true
    } else {
        Write-Status "ERROR" "Authentication failed"
        return $false
    }
}

# Test: Legacy Menu API
function Test-LegacyMenuAPI {
    Write-Status "INFO" "=== Testing Legacy Menu API ==="
    
    $headers = @{ Authorization = "Bearer $Global:Token" }
    
    # Test 1: Crear menú
    Write-Status "INFO" "Test 1: Creating menu via legacy API"
    $menuData = @{
        description = "Test Menu Legacy API PowerShell"
        capacity = 20
    }
    
    $result = Invoke-ApiRequest -Method "POST" -Endpoint "/menu/create" -Headers $headers -Body $menuData
    
    if ($result.Success -and $result.Data.id) {
        $menuId = $result.Data.id
        Write-Status "SUCCESS" "Menu created with ID: $menuId"
        $Global:TestResults += "✅ Legacy Menu Creation"
        
        # Test 2: Agregar item al menú
        Write-Status "INFO" "Test 2: Adding item to menu"
        $itemData = @{
            menuId = $menuId
            name = "Pizza Test PowerShell"
            price = 15.99
            ingredients = @("tomate", "mozzarella")
            deliveryTime = 30
        }
        
        $itemResult = Invoke-ApiRequest -Method "POST" -Endpoint "/menu/add-item" -Headers $headers -Body $itemData
        
        if ($itemResult.Success) {
            Write-Status "SUCCESS" "Menu item added successfully"
            $Global:TestResults += "✅ Legacy Menu Item Creation"
        } else {
            $Global:TestResults += "❌ Legacy Menu Item Creation"
        }
    } else {
        $Global:TestResults += "❌ Legacy Menu Creation"
        return
    }
    
    # Test 3: Obtener menús del usuario
    Write-Status "INFO" "Test 3: Getting user menus"
    $menusResult = Invoke-ApiRequest -Method "GET" -Endpoint "/menu/me" -Headers $headers
    
    if ($menusResult.Success) {
        $menuCount = $menusResult.Data.Count
        Write-Status "SUCCESS" "Found $menuCount menus"
        $Global:TestResults += "✅ Legacy Menu List - $menuCount menus"
    } else {
        $Global:TestResults += "❌ Legacy Menu List"
    }
}

# Test: Legacy Wardrobe API
function Test-LegacyWardrobeAPI {
    Write-Status "INFO" "=== Testing Legacy Wardrobe API ==="
    
    $headers = @{ Authorization = "Bearer $Global:Token" }
    
    # Test 1: Crear wardrobe
    Write-Status "INFO" "Test 1: Creating wardrobe via legacy API"
    $wardrobeData = @{
        description = "Test Wardrobe Legacy API PowerShell"
        capacity = 50
    }
    
    $result = Invoke-ApiRequest -Method "POST" -Endpoint "/wardrobe/create" -Headers $headers -Body $wardrobeData
    
    if ($result.Success -and $result.Data.id) {
        $wardrobeId = $result.Data.id
        Write-Status "SUCCESS" "Wardrobe created with ID: $wardrobeId"
        $Global:TestResults += "✅ Legacy Wardrobe Creation"
        
        # Test 2: Agregar item al wardrobe
        Write-Status "INFO" "Test 2: Adding item to wardrobe"
        $itemData = @{
            wardrobeId = $wardrobeId
            name = "Test Shirt PowerShell"
            price = 29.99
            brand = "Nike"
            sizes = @("S", "M", "L")
            color = "Blue"
            quantity = 10
        }
        
        $itemResult = Invoke-ApiRequest -Method "POST" -Endpoint "/wardrobe/add-item" -Headers $headers -Body $itemData
        
        if ($itemResult.Success) {
            Write-Status "SUCCESS" "Wardrobe item added successfully"
            $Global:TestResults += "✅ Legacy Wardrobe Item Creation"
        } else {
            $Global:TestResults += "❌ Legacy Wardrobe Item Creation"
        }
    } else {
        $Global:TestResults += "❌ Legacy Wardrobe Creation"
        return
    }
    
    # Test 3: Obtener wardrobes del usuario
    Write-Status "INFO" "Test 3: Getting user wardrobes"
    $wardrobesResult = Invoke-ApiRequest -Method "GET" -Endpoint "/wardrobe/me" -Headers $headers
    
    if ($wardrobesResult.Success) {
        $wardrobeCount = $wardrobesResult.Data.Count
        Write-Status "SUCCESS" "Found $wardrobeCount wardrobes"
        $Global:TestResults += "✅ Legacy Wardrobe List - $wardrobeCount items"
    } else {
        $Global:TestResults += "❌ Legacy Wardrobe List"
    }
}

# Test: New Catalog API
function Test-NewCatalogAPI {
    Write-Status "INFO" "=== Testing New Catalog API ==="
    
    $headers = @{ Authorization = "Bearer $Global:Token" }
    
    # Test 1: Crear catálogo
    Write-Status "INFO" "Test 1: Creating catalog via new API"
    $catalogData = @{
        catalogType = "MENU"
        name = "Test Catalog New API PowerShell"
        description = "Testing new catalog system from PowerShell"
        isPublic = $true
        tags = @("test", "api", "powershell")
        metadata = @{ location = "Test City PowerShell" }
        settings = @{ allowReviews = $true }
    }
    
    $result = Invoke-ApiRequest -Method "POST" -Endpoint "/catalogs" -Headers $headers -Body $catalogData
    
    if ($result.Success -and $result.Data.id) {
        $catalogId = $result.Data.id
        Write-Status "SUCCESS" "Catalog created with ID: $catalogId"
        $Global:TestResults += "✅ New Catalog Creation"
        
        # Test 2: Agregar item al catálogo
        Write-Status "INFO" "Test 2: Adding item to catalog"
        $itemData = @{
            name = "Test Catalog Item PowerShell"
            price = 25.50
            description = "Test item for catalog from PowerShell"
            attributes = @{ category = "test"; featured = $true }
            metadata = @{ priority = "high" }
        }
        
        $itemResult = Invoke-ApiRequest -Method "POST" -Endpoint "/catalogs/$catalogId/items" -Headers $headers -Body $itemData
        
        if ($itemResult.Success) {
            Write-Status "SUCCESS" "Catalog item added successfully"
            $Global:TestResults += "✅ New Catalog Item Creation"
        } else {
            $Global:TestResults += "❌ New Catalog Item Creation"
        }
    } else {
        $Global:TestResults += "❌ New Catalog Creation"
        return
    }
    
    # Test 3: Obtener mis catálogos
    Write-Status "INFO" "Test 3: Getting my catalogs"
    $catalogsResult = Invoke-ApiRequest -Method "GET" -Endpoint "/catalogs/my-catalogs" -Headers $headers
    
    if ($catalogsResult.Success) {
        $catalogCount = $catalogsResult.Data.Count
        Write-Status "SUCCESS" "Found $catalogCount catalogs"
        $Global:TestResults += "✅ New Catalog List - $catalogCount items"
    } else {
        $Global:TestResults += "❌ New Catalog List"
    }
    
    # Test 4: Filtrar por tipo MENU
    Write-Status "INFO" "Test 4: Filtering catalogs by type MENU"
    $menuCatalogsResult = Invoke-ApiRequest -Method "GET" -Endpoint "/catalogs/my-catalogs?type=MENU" -Headers $headers
    
    if ($menuCatalogsResult.Success) {
        $menuCatalogCount = $menuCatalogsResult.Data.Count
        Write-Status "SUCCESS" "Found $menuCatalogCount MENU catalogs"
        $Global:TestResults += "✅ Catalog Filtering MENU - $menuCatalogCount items"
    } else {
        $Global:TestResults += "❌ Catalog Filtering MENU"
    }
}

# Test: Membership Integration
function Test-MembershipIntegration {
    Write-Status "INFO" "=== Testing Membership Integration ==="
    
    $headers = @{ Authorization = "Bearer $Global:Token" }
    
    # Test 1: Verificar límites de membresía
    Write-Status "INFO" "Test 1: Checking membership limits"
    $limitsResult = Invoke-ApiRequest -Method "GET" -Endpoint "/membership/limits" -Headers $headers
    
    if ($limitsResult.Success) {
        Write-Status "SUCCESS" "Membership limits retrieved"
        $Global:TestResults += "✅ Membership Limits Check"
        Write-Host "Limits: $($limitsResult.Data | ConvertTo-Json -Depth 2)" -ForegroundColor Cyan
    } else {
        $Global:TestResults += "❌ Membership Limits Check"
    }
    
    # Test 2: Verificar membresía actual
    Write-Status "INFO" "Test 2: Checking current membership"
    $membershipResult = Invoke-ApiRequest -Method "GET" -Endpoint "/membership" -Headers $headers
    
    if ($membershipResult.Success) {
        $membershipType = $membershipResult.Data.membershipType
        Write-Status "SUCCESS" "Current membership: $membershipType"
        $Global:TestResults += "✅ Current Membership Check - $membershipType"
    } else {
        $Global:TestResults += "❌ Current Membership Check"
    }
}

# Test: Public Endpoints
function Test-PublicEndpoints {
    Write-Status "INFO" "=== Testing Public Endpoints ==="
    
    # Test 1: Buscar catálogos públicos
    Write-Status "INFO" "Test 1: Searching public catalogs"
    $searchResult = Invoke-ApiRequest -Method "GET" -Endpoint "/catalogs/public/search?query=test&limit=5"
    
    if ($searchResult.Success) {
        $publicCount = if ($searchResult.Data.results) { $searchResult.Data.results.Count } else { 0 }
        Write-Status "SUCCESS" "Found $publicCount public catalogs"
        $Global:TestResults += "✅ Public Catalog Search - $publicCount items"
    } else {
        $Global:TestResults += "❌ Public Catalog Search"
    }
}

# Test: Error Handling
function Test-ErrorHandling {
    Write-Status "INFO" "=== Testing Error Handling ==="
    
    # Test 1: Endpoint sin autenticación
    Write-Status "INFO" "Test 1: Testing unauthorized access"
    $unauthorizedResult = Invoke-ApiRequest -Method "GET" -Endpoint "/catalogs/my-catalogs"
    
    if (-not $unauthorizedResult.Success) {
        Write-Status "SUCCESS" "Correctly rejected unauthorized access"
        $Global:TestResults += "✅ Unauthorized Access Handling"
    } else {
        Write-Status "ERROR" "Should have rejected unauthorized access"
        $Global:TestResults += "❌ Unauthorized Access Handling"
    }
    
    # Test 2: Endpoint con ID inexistente
    Write-Status "INFO" "Test 2: Testing non-existent catalog access"
    $headers = @{ Authorization = "Bearer $Global:Token" }
    $nonExistentResult = Invoke-ApiRequest -Method "GET" -Endpoint "/catalogs/non-existent-id" -Headers $headers
    
    if (-not $nonExistentResult.Success) {
        Write-Status "SUCCESS" "Correctly handled non-existent catalog"
        $Global:TestResults += "✅ Non-existent Resource Handling"
    } else {
        Write-Status "WARNING" "Non-existent catalog request should fail"
        $Global:TestResults += "⚠️ Non-existent Resource Handling"
    }
}

# Función para mostrar resumen
function Show-Summary {
    Write-Status "INFO" "=== TEST SUMMARY ==="
    
    $totalTests = $Global:TestResults.Count
    $passedTests = 0
    $failedTests = 0
    $warnings = 0
    
    foreach ($result in $Global:TestResults) {
        Write-Host $result
        if ($result -like "*✅*") { $passedTests++ }
        elseif ($result -like "*❌*") { $failedTests++ }
        elseif ($result -like "*⚠️*") { $warnings++ }
    }
    
    Write-Host ""
    Write-Status "INFO" "Total Tests: $totalTests"
    Write-Status "SUCCESS" "Passed: $passedTests"
    Write-Status "ERROR" "Failed: $failedTests"
    Write-Status "WARNING" "Warnings: $warnings"
    
    if ($failedTests -eq 0) {
        Write-Status "SUCCESS" "🎉 ALL TESTS PASSED! System is working correctly."
        return $true
    } else {
        Write-Status "ERROR" "❌ Some tests failed. Please review the issues above."
        return $false
    }
}

# Función principal
function Main {
    Write-Host "======================================================" -ForegroundColor Cyan
    Write-Host "    MenuCom Catalog System - Automated Testing (PS)"  -ForegroundColor Cyan
    Write-Host "======================================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Ejecutar tests
    if (-not (Test-Authentication)) {
        Write-Status "ERROR" "Authentication failed. Cannot continue with tests."
        return $false
    }
    
    Test-LegacyMenuAPI
    Test-LegacyWardrobeAPI
    Test-NewCatalogAPI
    Test-MembershipIntegration
    Test-PublicEndpoints
    Test-ErrorHandling
    
    return Show-Summary
}

# Ejecutar si se llama directamente
if ($MyInvocation.InvocationName -eq $MyInvocation.MyCommand.Name) {
    $success = Main
    if (-not $success) {
        exit 1
    }
}