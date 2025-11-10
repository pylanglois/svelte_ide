import { eventBus } from '@/core/EventBusService.svelte.js'
import { indexedDBService } from '@/core/persistence/IndexedDBService.svelte.js'

/**
 * Test helper used in development builds to observe the persistence/hydration lifecycle.
 * Attach via window.installPersistenceDiagnostics() to monitor emitted events and promises.
 */
export function installPersistenceDiagnostics({ timeoutMs = 8000 } = {}) {
  const timeline = []
  const logEvent = (type, payload) => {
    const entry = {
      type,
      payload,
      recordedAt: new Date().toISOString()
    }
    timeline.push(entry)
    console.debug('[persistenceDiagnostics]', entry)
  }

  const unsubscribers = [
    eventBus.subscribe('persistence:ready', (payload) => logEvent('persistence:ready', payload)),
    eventBus.subscribe('persistence:error', (payload) => logEvent('persistence:error', payload)),
    eventBus.subscribe('hydration:before', (payload) => logEvent('hydration:before', payload)),
    eventBus.subscribe('hydration:after', (payload) => logEvent('hydration:after', payload))
  ]

  indexedDBService
    .readyForEncryption({ timeoutMs })
    .then((payload) => logEvent('readyForEncryption:resolved', payload))
    .catch((error) =>
      logEvent('readyForEncryption:rejected', {
        message: error?.message || 'unknown error'
      })
    )

  return {
    timeline,
    dispose() {
      unsubscribers.forEach((unsub) => unsub?.())
    }
  }
}

if (typeof window !== 'undefined') {
  window.installPersistenceDiagnostics = (options) => installPersistenceDiagnostics(options)
}
