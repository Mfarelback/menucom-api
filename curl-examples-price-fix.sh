# Ejemplos de curl corregidos para parsing de price y discountPrice

echo "=== CURL Examples for Correct Price Parsing ==="

echo ""
echo "# 1. JSON with numeric values (RECOMMENDED)"
echo "curl -X POST \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -H 'Authorization: Bearer YOUR_TOKEN' \\"
echo "  -d '{"
echo '    "name": "Item with Numeric Prices",'
echo '    "description": "Description",'
echo '    "price": 12.99,'
echo '    "discountPrice": 11.50,'
echo '    "isAvailable": true,'
echo '    "attributes": {}'
echo "  }' \\"
echo "  http://localhost:3001/catalogs/CATALOG_ID/items"

echo ""
echo "# 2. JSON with string prices (will be converted)"
echo "curl -X POST \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -H 'Authorization: Bearer YOUR_TOKEN' \\"
echo "  -d '{"
echo '    "name": "Item with String Prices",'
echo '    "description": "Description",'
echo '    "price": "12.99",'
echo '    "discountPrice": "11.50",'
echo '    "isAvailable": true,'
echo '    "attributes": {}'
echo "  }' \\"
echo "  http://localhost:3001/catalogs/CATALOG_ID/items"

echo ""
echo "# 3. Form-data (automatically converted from strings)"
echo "curl -X POST \\"
echo "  -H 'Authorization: Bearer YOUR_TOKEN' \\"
echo "  -F 'name=Item with Form Data' \\"
echo "  -F 'description=Description' \\"
echo "  -F 'price=12.99' \\"
echo "  -F 'discountPrice=11.50' \\"
echo "  -F 'isAvailable=true' \\"
echo "  -F 'attributes={}' \\"
echo "  http://localhost:3001/catalogs/CATALOG_ID/items"

echo ""
echo "# 4. Form-data with image upload"
echo "curl -X POST \\"
echo "  -H 'Authorization: Bearer YOUR_TOKEN' \\"
echo "  -F 'name=Item with Image' \\"
echo "  -F 'description=Item with uploaded image' \\"
echo "  -F 'price=15.00' \\"
echo "  -F 'discountPrice=12.00' \\"
echo "  -F 'isAvailable=true' \\"
echo "  -F 'attributes={}' \\"
echo "  -F 'photo=@/path/to/image.jpg' \\"
echo "  http://localhost:3001/catalogs/CATALOG_ID/items"

echo ""
echo "# Expected Response (prices should be numbers, not strings):"
echo '{'
echo '  "id": "uuid",'
echo '  "name": "Item name",'
echo '  "price": 12.99,          // NUMBER, not "12.99"'
echo '  "discountPrice": 11.50,  // NUMBER, not "11.50"'
echo '  "averageRating": 0,      // NUMBER, not "0.00"'
echo '  "isAvailable": true,'
echo '  "attributes": {},'
echo '  // ... other fields'
echo '}'

echo ""
echo "=== Notes ==="
echo "- The transformer in the entity converts decimal strings from DB to numbers"
echo "- The DTO transforms string inputs from form-data/JSON to numbers"
echo "- If still seeing strings, restart the server to apply entity changes"