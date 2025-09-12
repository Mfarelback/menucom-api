const axios = require('axios');

async function testStoreURL() {
  try {
    // Primero, necesitamos obtener un token JWT válido
    // Para el test, asumiremos que necesitamos hacer login primero
    
    console.log('🧪 Testeando el nuevo campo storeURL en /user/by-roles');
    console.log('📍 Variable MP_BACK_URL desde .env:', process.env.MP_BACK_URL || 'https://menu-comerce.netlify.app');
    
    // Hacer una petición POST a /user/by-roles
    const response = await axios.post('http://localhost:3001/user/by-roles', {
      roles: ['admin', 'manager', 'user'],
      withVinculedAccount: false,
      includeMenus: false
    }, {
      headers: {
        'Content-Type': 'application/json',
        // Nota: En un test real necesitarías un JWT token válido
        // 'Authorization': 'Bearer tu_jwt_token_aqui'
      }
    });

    console.log('✅ Respuesta del endpoint:');
    
    if (response.data && response.data.length > 0) {
      console.log('\n📊 Datos del primer usuario:');
      console.log(`- ID: ${response.data[0].id}`);
      console.log(`- Email: ${response.data[0].email}`);
      console.log(`- Name: ${response.data[0].name}`);
      console.log(`- Role: ${response.data[0].role}`);
      console.log(`- storeURL: ${response.data[0].storeURL}`);
      
      // Verificar que storeURL tiene el formato esperado
      if (response.data[0].storeURL) {
        const baseUrl = process.env.MP_BACK_URL || 'https://menu-comerce.netlify.app';
        const expectedFormat = `${baseUrl}/${response.data[0].id}`;
        if (response.data[0].storeURL === expectedFormat) {
          console.log('✅ storeURL tiene el formato correcto!');
        } else {
          console.log('❌ storeURL no tiene el formato esperado');
          console.log(`   Esperado: ${expectedFormat}`);
          console.log(`   Recibido: ${response.data[0].storeURL}`);
        }
      } else {
        console.log('❌ storeURL no está presente en la respuesta');
      }
    } else {
      console.log('ℹ️  No se encontraron usuarios');
    }

  } catch (error) {
    console.error('❌ Error al testear el endpoint:');
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Message: ${error.response.data?.message || error.response.statusText}`);
      
      // Si es error 401, es porque necesita autenticación
      if (error.response.status === 401) {
        console.log('\n💡 Nota: Este endpoint requiere autenticación JWT');
        console.log('   Para testearlo completamente, necesitas un token válido');
      }
    } else {
      console.error(`   ${error.message}`);
    }
  }
}

// Ejecutar el test
testStoreURL();
