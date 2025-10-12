async function testSync() {
  const orderId = 'ORD123456';  // Example order ID
  const status = 'shipped';  // Status to sync

  const response = await fetch('http://localhost:3001/api/order-status-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, status }),
  });

  const result = await response.json();
  console.log(result);
}

testSync();
