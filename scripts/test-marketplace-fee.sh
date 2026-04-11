#!/bin/bash

# Script de testing manual para Marketplace Fee
# Usar desde la raíz del proyecto: ./scripts/test-marketplace-fee.sh

echo "🧪 Testing Marketplace Fee Implementation"
echo "========================================="

# Configuración
BASE_URL="http://localhost:3000"
ADMIN_TOKEN="YOUR_ADMIN_TOKEN_HERE"  # Reemplazar con token real

echo ""
echo "📋 Paso 1: Verificar estado inicial (sin configuración)"
echo "GET $BASE_URL/app-data/marketplace-fee"
curl -s -X GET "$BASE_URL/app-data/marketplace-fee" | jq '.'

echo ""
echo "📋 Paso 2: Configurar marketplace fee al 5.5%"
echo "POST $BASE_URL/app-data/marketplace-fee"
curl -s -X POST "$BASE_URL/app-data/marketplace-fee" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"percentage": 5.5}' | jq '.'

echo ""
echo "📋 Paso 3: Verificar configuración"
echo "GET $BASE_URL/app-data/marketplace-fee"
curl -s -X GET "$BASE_URL/app-data/marketplace-fee" | jq '.'

echo ""
echo "📋 Paso 4: Probar validaciones (debe fallar)"
echo "POST con percentage negativo:"
curl -s -X POST "$BASE_URL/app-data/marketplace-fee" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"percentage": -1}' | jq '.'

echo ""
echo "POST con percentage mayor a 100:"
curl -s -X POST "$BASE_URL/app-data/marketplace-fee" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"percentage": 101}' | jq '.'

echo ""
echo "📋 Paso 5: Crear orden de prueba (subtotal: $1000)"
echo "POST $BASE_URL/orders"
curl -s -X POST "$BASE_URL/orders" \
  -H "Content-Type: application/json" \
  -d '{
    "customerEmail": "test@example.com",
    "customerPhone": "1234567890",
    "total": 1000,
    "items": [
      {
        "name": "Producto Test",
        "price": 1000,
        "quantity": 1
      }
    ]
  }' | jq '.'

echo ""
echo "📋 Paso 6: Cambiar fee a 0% y probar"
curl -s -X POST "$BASE_URL/app-data/marketplace-fee" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"percentage": 0}' | jq '.'

echo ""
echo "Crear otra orden con 0% fee:"
curl -s -X POST "$BASE_URL/orders" \
  -H "Content-Type: application/json" \
  -d '{
    "customerEmail": "test2@example.com",
    "total": 1000,
    "items": [
      {
        "name": "Producto Test 2",
        "price": 1000,
        "quantity": 1
      }
    ]
  }' | jq '.'

echo ""
echo "📋 Paso 7: Verificar en base de datos"
echo "Ejecutar en tu cliente SQL:"
echo "SELECT * FROM app_data WHERE key = 'marketplace_fee_percentage';"
echo "SELECT id, subtotal, marketplaceFeePercentage, marketplaceFeeAmount, total FROM orders ORDER BY createdAt DESC LIMIT 5;"

echo ""
echo "✅ Testing manual completado!"
echo ""
echo "📝 Casos de uso a verificar:"
echo "1. ✅ Configuración inicial retorna 0%"
echo "2. ✅ Configuración por admin funciona"
echo "3. ✅ Validaciones de rango funcionan"
echo "4. ✅ Órdenes calculan comisión correctamente"
echo "5. ✅ Fee de 0% funciona correctamente"
echo ""
echo "🔧 Próximos pasos:"
echo "- Verificar integración con MercadoPago"
echo "- Probar con diferentes porcentajes"
echo "- Verificar persistencia después de reinicio"
echo "- Probar con montos decimales"
