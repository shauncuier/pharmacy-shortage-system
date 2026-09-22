import { shortageEvents } from '@/lib/shortage-events'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: Request) {
  let isClosed = false

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()

      // Send initial connect frame
      try {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`)
        )
      } catch {
        isClosed = true
        return
      }

      // Handler for shortage change events
      const onChange = (data: unknown) => {
        if (isClosed) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {
          isClosed = true
        }
      }

      shortageEvents.on('change', onChange)

      // Send heartbeat comment every 15 seconds to keep connection alive through LAN proxies
      const heartbeatInterval = setInterval(() => {
        if (isClosed) {
          clearInterval(heartbeatInterval)
          return
        }
        try {
          controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`))
        } catch {
          isClosed = true
          clearInterval(heartbeatInterval)
        }
      }, 15000)

      // Clean up when client disconnects
      req.signal.addEventListener('abort', () => {
        isClosed = true
        clearInterval(heartbeatInterval)
        shortageEvents.off('change', onChange)
      })
    },
    cancel() {
      isClosed = true
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform, no-store',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
