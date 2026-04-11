#!/bin/bash
# Script de Testing Automatizado para Sistema de Catálogos MenuCom
# Autor: Sistema de Refactorización MenuCom
# Fecha: 2025-10-10

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuración
BASE_URL="http://localhost:3000"
API_URL="${BASE_URL}"

# Variables globales
TOKEN=""
MENU_ID=""
WARDROBE_ID=""
CATALOG_ID=""
TEST_RESULTS=()

# Función para imprimir con colores
print_status() {
    local status=$1
    local message=$2
    case $status in
        "SUCCESS") echo -e "${GREEN}✅ SUCCESS: $message${NC}" ;;
        "ERROR") echo -e "${RED}❌ ERROR: $message${NC}" ;;
        "INFO") echo -e "${BLUE}ℹ️  INFO: $message${NC}" ;;
        "WARNING") echo -e "${YELLOW}⚠️  WARNING: $message${NC}" ;;
    esac
}

# Función para hacer request con error handling
make_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    local headers=$4
    
    print_status "INFO" "Testing: $method $endpoint"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "%{http_code}" $headers "$API_URL$endpoint")
    else
        response=$(curl -s -w "%{http_code}" -X $method $headers "$API_URL$endpoint" $data)
    fi
    
    # Extraer código de estado
    http_code="${response: -3}"
    body="${response%???}"
    
    if [[ $http_code -ge 200 && $http_code -lt 300 ]]; then
        print_status "SUCCESS" "$method $endpoint - HTTP $http_code"
        echo "$body"
        return 0
    else
        print_status "ERROR" "$method $endpoint - HTTP $http_code"
        echo "$body"
        return 1
    fi
}

# Función de autenticación
authenticate() {
    print_status "INFO" "Authenticating user..."
    
    local auth_data='{
        "email": "admin@username.com",
        "password": "password"
    }'
    
    response=$(make_request "POST" "/auth/login" "-d '$auth_data'" "-H 'Content-Type: application/json'")
    
    if [ $? -eq 0 ]; then
        TOKEN=$(echo "$response" | jq -r '.access_token // empty')
        if [ -n "$TOKEN" ]; then
            print_status "SUCCESS" "Authentication successful"
            return 0
        fi
    fi
    
    print_status "ERROR" "Authentication failed"
    return 1
}

# Test 1: Legacy Menu API
test_legacy_menu() {
    print_status "INFO" "=== Testing Legacy Menu API ==="
    
    # Test 1.1: Crear menú
    print_status "INFO" "Test 1.1: Creating menu via legacy API"
    local menu_data='{
        "description": "Test Menu Legacy API",
        "capacity": 20
    }'
    
    response=$(make_request "POST" "/menu/create" "-d '$menu_data'" "-H 'Authorization: Bearer $TOKEN' -H 'Content-Type: application/json'")
    
    if [ $? -eq 0 ]; then
        MENU_ID=$(echo "$response" | jq -r '.id // empty')
        if [ -n "$MENU_ID" ]; then
            print_status "SUCCESS" "Menu created with ID: $MENU_ID"
            TEST_RESULTS+=("✅ Legacy Menu Creation")
        else
            print_status "ERROR" "No menu ID in response"
            TEST_RESULTS+=("❌ Legacy Menu Creation - No ID")
            return 1
        fi
    else
        TEST_RESULTS+=("❌ Legacy Menu Creation - Request Failed")
        return 1
    fi
    
    # Test 1.2: Obtener menús del usuario
    print_status "INFO" "Test 1.2: Getting user menus"
    response=$(make_request "GET" "/menu/me" "" "-H 'Authorization: Bearer $TOKEN'")
    
    if [ $? -eq 0 ]; then
        menu_count=$(echo "$response" | jq '. | length')
        print_status "SUCCESS" "Found $menu_count menus"
        TEST_RESULTS+=("✅ Legacy Menu List - $menu_count menus")
    else
        TEST_RESULTS+=("❌ Legacy Menu List")
    fi
    
    # Test 1.3: Agregar item al menú
    if [ -n "$MENU_ID" ]; then
        print_status "INFO" "Test 1.3: Adding item to menu"
        local item_data='{
            "menuId": "'$MENU_ID'",
            "name": "Pizza Test",
            "price": 15.99,
            "ingredients": ["tomate", "mozzarella"],
            "deliveryTime": 30
        }'
        
        response=$(make_request "POST" "/menu/add-item" "-d '$item_data'" "-H 'Authorization: Bearer $TOKEN' -H 'Content-Type: application/json'")
        
        if [ $? -eq 0 ]; then
            print_status "SUCCESS" "Menu item added successfully"
            TEST_RESULTS+=("✅ Legacy Menu Item Creation")
        else
            TEST_RESULTS+=("❌ Legacy Menu Item Creation")
        fi
    fi
}

# Test 2: Legacy Wardrobe API
test_legacy_wardrobe() {
    print_status "INFO" "=== Testing Legacy Wardrobe API ==="
    
    # Test 2.1: Crear wardrobe
    print_status "INFO" "Test 2.1: Creating wardrobe via legacy API"
    local wardrobe_data='{
        "description": "Test Wardrobe Legacy API",
        "capacity": 50
    }'
    
    response=$(make_request "POST" "/wardrobe/create" "-d '$wardrobe_data'" "-H 'Authorization: Bearer $TOKEN' -H 'Content-Type: application/json'")
    
    if [ $? -eq 0 ]; then
        WARDROBE_ID=$(echo "$response" | jq -r '.id // empty')
        if [ -n "$WARDROBE_ID" ]; then
            print_status "SUCCESS" "Wardrobe created with ID: $WARDROBE_ID"
            TEST_RESULTS+=("✅ Legacy Wardrobe Creation")
        else
            print_status "ERROR" "No wardrobe ID in response"
            TEST_RESULTS+=("❌ Legacy Wardrobe Creation - No ID")
            return 1
        fi
    else
        TEST_RESULTS+=("❌ Legacy Wardrobe Creation - Request Failed")
        return 1
    fi
    
    # Test 2.2: Obtener wardrobes del usuario
    print_status "INFO" "Test 2.2: Getting user wardrobes"
    response=$(make_request "GET" "/wardrobe/me" "" "-H 'Authorization: Bearer $TOKEN'")
    
    if [ $? -eq 0 ]; then
        wardrobe_count=$(echo "$response" | jq '. | length')
        print_status "SUCCESS" "Found $wardrobe_count wardrobes"
        TEST_RESULTS+=("✅ Legacy Wardrobe List - $wardrobe_count items")
    else
        TEST_RESULTS+=("❌ Legacy Wardrobe List")
    fi
    
    # Test 2.3: Agregar item al wardrobe
    if [ -n "$WARDROBE_ID" ]; then
        print_status "INFO" "Test 2.3: Adding item to wardrobe"
        local item_data='{
            "wardrobeId": "'$WARDROBE_ID'",
            "name": "Test Shirt",
            "price": 29.99,
            "brand": "Nike",
            "sizes": ["S", "M", "L"],
            "color": "Blue",
            "quantity": 10
        }'
        
        response=$(make_request "POST" "/wardrobe/add-item" "-d '$item_data'" "-H 'Authorization: Bearer $TOKEN' -H 'Content-Type: application/json'")
        
        if [ $? -eq 0 ]; then
            print_status "SUCCESS" "Wardrobe item added successfully"
            TEST_RESULTS+=("✅ Legacy Wardrobe Item Creation")
        else
            TEST_RESULTS+=("❌ Legacy Wardrobe Item Creation")
        fi
    fi
}

# Test 3: New Catalog API
test_new_catalog_api() {
    print_status "INFO" "=== Testing New Catalog API ==="
    
    # Test 3.1: Crear catálogo
    print_status "INFO" "Test 3.1: Creating catalog via new API"
    local catalog_data='{
        "catalogType": "MENU",
        "name": "Test Catalog New API",
        "description": "Testing new catalog system",
        "isPublic": true,
        "tags": ["test", "api", "new"],
        "metadata": {"location": "Test City"},
        "settings": {"allowReviews": true}
    }'
    
    response=$(make_request "POST" "/catalogs" "-d '$catalog_data'" "-H 'Authorization: Bearer $TOKEN' -H 'Content-Type: application/json'")
    
    if [ $? -eq 0 ]; then
        CATALOG_ID=$(echo "$response" | jq -r '.id // empty')
        if [ -n "$CATALOG_ID" ]; then
            print_status "SUCCESS" "Catalog created with ID: $CATALOG_ID"
            TEST_RESULTS+=("✅ New Catalog Creation")
        else
            print_status "ERROR" "No catalog ID in response"
            TEST_RESULTS+=("❌ New Catalog Creation - No ID")
            return 1
        fi
    else
        TEST_RESULTS+=("❌ New Catalog Creation - Request Failed")
        return 1
    fi
    
    # Test 3.2: Obtener mis catálogos
    print_status "INFO" "Test 3.2: Getting my catalogs"
    response=$(make_request "GET" "/catalogs/my-catalogs" "" "-H 'Authorization: Bearer $TOKEN'")
    
    if [ $? -eq 0 ]; then
        catalog_count=$(echo "$response" | jq '. | length')
        print_status "SUCCESS" "Found $catalog_count catalogs"
        TEST_RESULTS+=("✅ New Catalog List - $catalog_count items")
    else
        TEST_RESULTS+=("❌ New Catalog List")
    fi
    
    # Test 3.3: Filtrar por tipo MENU
    print_status "INFO" "Test 3.3: Filtering catalogs by type MENU"
    response=$(make_request "GET" "/catalogs/my-catalogs?type=MENU" "" "-H 'Authorization: Bearer $TOKEN'")
    
    if [ $? -eq 0 ]; then
        menu_catalog_count=$(echo "$response" | jq '. | length')
        print_status "SUCCESS" "Found $menu_catalog_count MENU catalogs"
        TEST_RESULTS+=("✅ Catalog Filtering MENU - $menu_catalog_count items")
    else
        TEST_RESULTS+=("❌ Catalog Filtering MENU")
    fi
    
    # Test 3.4: Agregar item al catálogo
    if [ -n "$CATALOG_ID" ]; then
        print_status "INFO" "Test 3.4: Adding item to catalog"
        local item_data='{
            "name": "Test Catalog Item",
            "price": 25.50,
            "description": "Test item for catalog",
            "attributes": {"category": "test", "featured": true},
            "metadata": {"priority": "high"}
        }'
        
        response=$(make_request "POST" "/catalogs/$CATALOG_ID/items" "-d '$item_data'" "-H 'Authorization: Bearer $TOKEN' -H 'Content-Type: application/json'")
        
        if [ $? -eq 0 ]; then
            print_status "SUCCESS" "Catalog item added successfully"
            TEST_RESULTS+=("✅ New Catalog Item Creation")
        else
            TEST_RESULTS+=("❌ New Catalog Item Creation")
        fi
    fi
}

# Test 4: Membership Integration
test_membership_integration() {
    print_status "INFO" "=== Testing Membership Integration ==="
    
    # Test 4.1: Verificar límites de membresía
    print_status "INFO" "Test 4.1: Checking membership limits"
    response=$(make_request "GET" "/membership/limits" "" "-H 'Authorization: Bearer $TOKEN'")
    
    if [ $? -eq 0 ]; then
        print_status "SUCCESS" "Membership limits retrieved"
        TEST_RESULTS+=("✅ Membership Limits Check")
        echo "$response" | jq .
    else
        TEST_RESULTS+=("❌ Membership Limits Check")
    fi
    
    # Test 4.2: Verificar membresía actual
    print_status "INFO" "Test 4.2: Checking current membership"
    response=$(make_request "GET" "/membership" "" "-H 'Authorization: Bearer $TOKEN'")
    
    if [ $? -eq 0 ]; then
        membership_type=$(echo "$response" | jq -r '.membershipType // "unknown"')
        print_status "SUCCESS" "Current membership: $membership_type"
        TEST_RESULTS+=("✅ Current Membership Check - $membership_type")
    else
        TEST_RESULTS+=("❌ Current Membership Check")
    fi
}

# Test 5: Public Endpoints
test_public_endpoints() {
    print_status "INFO" "=== Testing Public Endpoints ==="
    
    # Test 5.1: Buscar catálogos públicos
    print_status "INFO" "Test 5.1: Searching public catalogs"
    response=$(make_request "GET" "/catalogs/public/search?query=test&limit=5" "")
    
    if [ $? -eq 0 ]; then
        public_count=$(echo "$response" | jq '.results | length // 0')
        print_status "SUCCESS" "Found $public_count public catalogs"
        TEST_RESULTS+=("✅ Public Catalog Search - $public_count items")
    else
        TEST_RESULTS+=("❌ Public Catalog Search")
    fi
}

# Test 6: Error Handling
test_error_handling() {
    print_status "INFO" "=== Testing Error Handling ==="
    
    # Test 6.1: Endpoint sin autenticación
    print_status "INFO" "Test 6.1: Testing unauthorized access"
    response=$(make_request "GET" "/catalogs/my-catalogs" "" "")
    
    if [ $? -ne 0 ]; then
        print_status "SUCCESS" "Correctly rejected unauthorized access"
        TEST_RESULTS+=("✅ Unauthorized Access Handling")
    else
        print_status "ERROR" "Should have rejected unauthorized access"
        TEST_RESULTS+=("❌ Unauthorized Access Handling")
    fi
    
    # Test 6.2: Endpoint con ID inexistente
    print_status "INFO" "Test 6.2: Testing non-existent catalog access"
    response=$(make_request "GET" "/catalogs/non-existent-id" "" "-H 'Authorization: Bearer $TOKEN'")
    
    if [ $? -ne 0 ]; then
        print_status "SUCCESS" "Correctly handled non-existent catalog"
        TEST_RESULTS+=("✅ Non-existent Resource Handling")
    else
        print_status "WARNING" "Non-existent catalog request should fail"
        TEST_RESULTS+=("⚠️ Non-existent Resource Handling")
    fi
}

# Función para mostrar resumen
show_summary() {
    print_status "INFO" "=== TEST SUMMARY ==="
    
    local total_tests=${#TEST_RESULTS[@]}
    local passed_tests=0
    local failed_tests=0
    local warnings=0
    
    for result in "${TEST_RESULTS[@]}"; do
        echo "$result"
        if [[ $result == *"✅"* ]]; then
            ((passed_tests++))
        elif [[ $result == *"❌"* ]]; then
            ((failed_tests++))
        elif [[ $result == *"⚠️"* ]]; then
            ((warnings++))
        fi
    done
    
    echo ""
    print_status "INFO" "Total Tests: $total_tests"
    print_status "SUCCESS" "Passed: $passed_tests"
    print_status "ERROR" "Failed: $failed_tests"
    print_status "WARNING" "Warnings: $warnings"
    
    if [ $failed_tests -eq 0 ]; then
        print_status "SUCCESS" "🎉 ALL TESTS PASSED! System is working correctly."
        return 0
    else
        print_status "ERROR" "❌ Some tests failed. Please review the issues above."
        return 1
    fi
}

# Función principal
main() {
    echo "======================================================"
    echo "    MenuCom Catalog System - Automated Testing"
    echo "======================================================"
    echo ""
    
    # Verificar dependencias
    if ! command -v jq &> /dev/null; then
        print_status "ERROR" "jq is required but not installed. Please install jq."
        exit 1
    fi
    
    if ! command -v curl &> /dev/null; then
        print_status "ERROR" "curl is required but not installed. Please install curl."
        exit 1
    fi
    
    # Ejecutar tests
    authenticate || exit 1
    
    test_legacy_menu
    test_legacy_wardrobe
    test_new_catalog_api
    test_membership_integration
    test_public_endpoints
    test_error_handling
    
    show_summary
}

# Ejecutar si se llama directamente
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi