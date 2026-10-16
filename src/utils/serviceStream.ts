import { fetchEventSource } from '@microsoft/fetch-event-source'
import type { ServiceState } from '@/stores/service'

export interface ServiceStreamHandlers {
    onState: (state: ServiceState) => void
    onConnected?: () => void
    onDisconnected?: () => void
}

export interface ServiceStreamOptions {
    url: string
    headers?: Record<string, string>
    minRetryMs?: number
    maxRetryMs?: number
}

class FatalStreamError extends Error {}

/**
 * Opens the server's state stream with fetch (a browser EventSource cannot send
 * the Basic-auth header). It reconnects with backoff, and the library closes the
 * connection while the tab is hidden and reopens it when the tab is visible.
 * Returns a function that stops the stream.
 */
export function openServiceStream(options: ServiceStreamOptions, handlers: ServiceStreamHandlers): () => void {
    const controller = new AbortController()
    const minRetryMs = options.minRetryMs ?? 1000
    const maxRetryMs = options.maxRetryMs ?? 30000
    let attempt = 0

    fetchEventSource(options.url, {
        signal: controller.signal,
        headers: options.headers,
        openWhenHidden: false,

        async onopen(response) {
            const contentType = response.headers.get('content-type') || ''

            if (response.ok && contentType.includes('text/event-stream')) {
                attempt = 0
                handlers.onConnected?.()
                return
            }

            // Auth and client errors will not fix themselves; other errors retry
            if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                throw new FatalStreamError(`Stream rejected with ${response.status}`)
            }

            throw new Error(`Stream failed with ${response.status}`)
        },

        onmessage(message) {
            if (message.event !== 'state' || !message.data) {
                return
            }

            try {
                handlers.onState(JSON.parse(message.data))
            } catch {
                // A malformed event is ignored; the next state replaces it
            }
        },

        onclose() {
            handlers.onDisconnected?.()
            // Throwing makes the library retry
            throw new Error('Stream closed')
        },

        onerror(err) {
            handlers.onDisconnected?.()

            if (err instanceof FatalStreamError) {
                throw err
            }

            attempt += 1
            return Math.min(maxRetryMs, minRetryMs * 2 ** (attempt - 1))
        },
    }).catch(() => {
        // Fatal errors and aborts end here; the caller's disconnected state already applies
    })

    return () => controller.abort()
}
