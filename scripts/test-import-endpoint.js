require('dotenv').config({ path: '.env.local' });

async function testImportEndpoint() {
  console.log('🧪 Testing import-order endpoint...');
  
  const importSharedSecret = process.env.IMPORT_SHARED_SECRET;
  
  if (!importSharedSecret) {
    console.error('❌ IMPORT_SHARED_SECRET not set in .env.local');
    return;
  }
  
  // Test with a dummy order ID
  const testOrderId = '12345678-1234-1234-1234-123456789012';
  
  try {
    console.log('📦 Testing order import...');
    console.log('- Order ID:', testOrderId);
    console.log('- Shared Secret:', importSharedSecret ? 'Set' : 'Missing');
    
    const response = await fetch('http://localhost:3001/api/import-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-shared-secret': importSharedSecret
      },
      body: JSON.stringify({
        orderId: testOrderId,
        source: 'IronXpress'
      })
    });
    
    const result = await response.json();
    
    console.log('\n📋 Response:');
    console.log('- Status:', response.status);
    console.log('- Body:', JSON.stringify(result, null, 2));
    
    if (response.ok && result.ok) {
      console.log('✅ Import endpoint test successful!');
      console.log('🎉 Pikago Order ID:', result.pikagoOrderId);
    } else {
      console.log('❌ Import endpoint test failed');
    }
    
  } catch (error) {
    console.error('❌ Error testing import endpoint:', error.message);
    console.log('\n💡 Make sure the development server is running:');
    console.log('   npm run dev');
  }
}

testImportEndpoint();
