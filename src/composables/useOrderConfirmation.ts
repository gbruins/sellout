import { onBeforeUnmount, onMounted, ref } from 'vue'
import { api, errorStatus, type OrderConfirmation } from '@/api'
import { useCartStore } from '@/stores/cart'

type CompleteOrder = Extract<OrderConfirmation, { status: 'complete' }>

export const POLL_INTERVAL_MS = 2000
// After this the page says payment is taking longer than usual, but keeps checking
export const SLOW_AFTER_MS = 20000
export const POLL_TIMEOUT_MS = 5 * 60 * 1000

/**
 * Polls the order confirmation for a Stripe Checkout Session until it is paid. Looked up by
 * the session id in the return URL, so it survives a refresh, a new tab or lost cart
 * credentials; the server completes the order itself if Stripe's webhook is late.
 */
export function useOrderConfirmation(sessionId: string | null) {
    const cart = useCartStore()

    const state = ref<'confirming' | 'slow' | 'complete' | 'missing'>('confirming')
    const order = ref<CompleteOrder | null>(null)

    let timer: ReturnType<typeof setTimeout> | null = null
    let stopped = false
    let startedAt = 0

    function stop() {
        stopped = true
        if(timer) {
            clearTimeout(timer)
            timer = null
        }
    }

    async function poll() {
        if(stopped) {
            return
        }

        try {
            const result = await api.orders.confirmation(sessionId!)

            if(result.status === 'complete') {
                order.value = result
                state.value = 'complete'
                stop()
                // The paid cart is closed now, so this browser's credentials for it are useless
                cart.forgetIfClosed()
                return
            }
        }
        catch(err) {
            if(errorStatus(err) === 404) {
                state.value = 'missing'
                stop()
                return
            }
            // Anything else is transient — keep trying
        }

        const elapsed = Date.now() - startedAt
        if(elapsed >= SLOW_AFTER_MS) {
            state.value = 'slow'
        }
        if(elapsed >= POLL_TIMEOUT_MS) {
            stop()
            return
        }

        timer = setTimeout(poll, POLL_INTERVAL_MS)
    }

    function start() {
        if(!sessionId) {
            state.value = 'missing'
            return
        }

        stop()
        stopped = false
        startedAt = Date.now()
        state.value = 'confirming'
        poll()
    }

    onMounted(start)
    onBeforeUnmount(stop)

    return { state, order, checkAgain: start }
}
