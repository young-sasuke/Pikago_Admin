import { mirrorIXStatus } from '@/lib/ironxpress-mirror'

export async function POST(req: Request) {
  const { orderId, status } = await req.json()
  
  // Map Pikago status to IronXpress status
  const ixStatus = status === 'shipped' ? 'shipped' : status
  
  // Call the mirror function to sync with IronXpress
  const success = await mirrorIXStatus(orderId, ixStatus)

  if (!success) {
    return new Response(JSON.stringify({ error: 'Failed to sync with IronXpress' }), { status: 500 })
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 })
}
