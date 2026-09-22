import { EventEmitter } from 'events'

// Global singleton event emitter across hot-reloads in Next.js development
declare global {
  // eslint-disable-next-line no-var
  var __shortageEventEmitter: EventEmitter | undefined
}

export const shortageEvents: EventEmitter =
  global.__shortageEventEmitter || new EventEmitter()

if (process.env.NODE_ENV !== 'production') {
  global.__shortageEventEmitter = shortageEvents
}

shortageEvents.setMaxListeners(200)

export function notifyShortageChange(action: string = 'update', metadata: Record<string, unknown> = {}) {
  try {
    shortageEvents.emit('change', {
      action,
      timestamp: Date.now(),
      ...metadata,
    })
  } catch (err) {
    console.error('Failed to emit shortage event:', err)
  }
}
