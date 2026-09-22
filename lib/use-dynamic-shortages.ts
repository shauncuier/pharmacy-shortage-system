'use client'

import { useEffect, useRef, useState } from 'react'

interface UseDynamicShortagesOptions {
  onUpdate: (silent: boolean) => void | Promise<void>
  pollIntervalMs?: number // default 3000ms (3 seconds)
  enabled?: boolean
}

export function useDynamicShortages({
  onUpdate,
  pollIntervalMs = 3000,
  enabled = true,
}: UseDynamicShortagesOptions) {
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate

  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false)
  const [lastSyncAt, setLastSyncAt] = useState<Date>(new Date())

  useEffect(() => {
    if (!enabled) return

    let eventSource: EventSource | null = null
    let channel: BroadcastChannel | null = null

    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    const triggerUpdate = () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        setLastSyncAt(new Date())
        onUpdateRef.current(true)
      }, 100)
    }

    // 1. Server-Sent Events (SSE) for instant 0ms server push
    try {
      if (typeof window !== 'undefined' && 'EventSource' in window) {
        eventSource = new EventSource('/api/shortages/stream')

        eventSource.onopen = () => {
          setIsLiveConnected(true)
        }

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            if (data && (data.action || data.type === 'change')) {
              triggerUpdate()
            }
          } catch {
            // Heartbeat or unparseable frame
          }
        }

        eventSource.onerror = () => {
          setIsLiveConnected(false)
          // EventSource will automatically attempt to reconnect in the background
        }
      }
    } catch (err) {
      console.warn('SSE could not be initialized, falling back to dynamic poll:', err)
    }

    // 2. BroadcastChannel for instant cross-tab sync in same browser
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        channel = new BroadcastChannel('bmh_shortage_sync')
        channel.onmessage = () => {
          triggerUpdate()
        }
      }
    } catch {
      // Optional feature
    }

    // 3. Adaptive auto-poll fallback:
    // If SSE is connected, fallback pulse every 15s instead of hammering every 3s.
    // If SSE is disconnected, poll at pollIntervalMs.
    let lastPollAt = Date.now()
    const pollTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        const isSseOpen = eventSource && eventSource.readyState === EventSource.OPEN
        const elapsed = Date.now() - lastPollAt
        if (isSseOpen && elapsed < 15000) {
          return
        }
        lastPollAt = Date.now()
        triggerUpdate()
      }
    }, pollIntervalMs)

    // 4. Instant refetch when user switches to tab or window regains focus
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        triggerUpdate()
      }
    }

    const handleFocus = () => {
      triggerUpdate()
    }

    window.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)

    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
      if (eventSource) {
        eventSource.close()
      }
      if (channel) {
        channel.close()
      }
      clearInterval(pollTimer)
      window.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [enabled, pollIntervalMs])

  return {
    isLiveConnected,
    lastSyncAt,
  }
}

/**
 * Helper to broadcast cross-tab sync locally in addition to server notifications.
 */
export function broadcastLocalShortageUpdate() {
  try {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel('bmh_shortage_sync')
      channel.postMessage({ type: 'change', timestamp: Date.now() })
      channel.close()
    }
  } catch {
    // Ignore BroadcastChannel errors
  }
}
