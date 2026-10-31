import { computed, inject, ref } from 'vue'
import { defineStore } from 'pinia'
import { cartErrorMessage } from '@/utils/cartErrors'
import type { MenuProduct } from '@/stores/service'

export interface CartLineData {
    id: string
    qty: number
    price_subtotal: number
    product: { id: string, title: string, base_price: number | null }
}

export interface Cart {
    id: string
    num_items: number
    price_subtotal: number
    grand_total: number
    customer_note: string | null
    checkout_in_progress: boolean
    cart_items: CartLineData[]
}

export type CartBusy = 'add' | 'update' | 'remove' | 'note' | 'pay' | 'cancel' | null

// The server owns the cart: every action replaces `cart` with the server's answer and
// nothing here computes totals.
export const useCartStore = defineStore('cart', () => {
    const api = inject<Record<string, any>>('$api') // eslint-disable-line @typescript-eslint/no-explicit-any

    const cart = ref<Cart | null>(null)
    const busy = ref<CartBusy>(null)
    const error = ref<string | null>(null)
    const unavailableProductId = ref<string | null>(null)
    // True when the last failure was a network or server error, so trying again may work
    const retryable = ref(false)
    // Set once a Checkout Session exists; the component mounts Stripe's Embedded Checkout with
    // it (research.md decision — inline on our own page, not a redirect to a Stripe-hosted one)
    const checkoutClientSecret = ref<string | null>(null)

    const count = computed(() => cart.value?.num_items ?? 0)
    const locked = computed(() => !!cart.value?.checkout_in_progress)

    const hasCart = () => !!api!.cart.credentials().id

    async function refresh() {
        const id = api!.cart.credentials().id
        const data = (await api!.cart.get()).data
        // The cart was forgotten (e.g. after payment) while this request was in flight
        if(api!.cart.credentials().id !== id) {
            return
        }
        cart.value = data
    }

    // Runs one action at a time; a second tap while busy does nothing
    async function run(kind: Exclude<CartBusy, null>, fn: () => Promise<unknown>, reload = true) {
        if(busy.value) {
            return false
        }

        busy.value = kind
        error.value = null
        retryable.value = false
        unavailableProductId.value = null

        try {
            const result = await fn()
            if(reload) {
                await refresh()
            }
            return result ?? true
        }
        catch(err) {
            error.value = cartErrorMessage(err)
            const status = (err as { response?: { status?: number } })?.response?.status
            retryable.value = !status || status >= 500
            const detail = (err as { response?: { data?: { data?: { code?: string, product_id?: string } } } })?.response?.data?.data
            if(detail?.code === 'item_unavailable') {
                unavailableProductId.value = detail.product_id ?? null
            }
            // A refused edit means this tab may be out of date, so show the server's cart
            if(status === 409) {
                try { await refresh() } catch { /* keep the message */ }
            }
            return false
        }
        finally {
            busy.value = null
        }
    }

    async function load() {
        if(!hasCart()) {
            cart.value = null
            return
        }

        try {
            await refresh()
        }
        catch(err) {
            const status = (err as { response?: { status?: number } })?.response?.status
            if(status === 404) {
                cart.value = null
            }
            else {
                // Keep the cart as it was; the visitor can retry
                error.value = cartErrorMessage(err)
                retryable.value = !status || status >= 500
            }
        }
    }

    function addPizza(pizza: MenuProduct, qty: number = 1) {
        return run('add', async () => {
            if(!hasCart()) {
                await api!.cart.create()
            }
            else if(!cart.value) {
                await refresh()
            }

            const line = cart.value?.cart_items.find((i) => i.product.id === pizza.id)
            if(line) {
                await api!.cart.updateItem({ id: line.id, qty: line.qty + qty })
            }
            else {
                await api!.cart.addItem({ product_id: pizza.id, qty })
            }
        })
    }

    function setQty(lineId: string, qty: number) {
        return run('update', () => api!.cart.updateItem({ id: lineId, qty }))
    }

    function remove(lineId: string) {
        return run('remove', () => api!.cart.removeItem(lineId))
    }

    function saveNote(note: string) {
        return run('note', () => api!.cart.setCustomerNote(note.trim() || null))
    }

    // Creates (or re-fetches) the Checkout Session and stores its client_secret for the
    // component to mount. Reloads the cart afterward (unlike most actions this store doesn't
    // reload for) so `locked` reflects the now-in-progress checkout right away — the visitor
    // stays on this page instead of navigating off, so that can't be left stale.
    async function pay(): Promise<boolean> {
        // checkoutClientSecret is set only after run()'s automatic refresh() below has already
        // updated cart.checkout_in_progress (and so `locked`) — CartView only mounts Stripe's
        // embedded form once `locked` is true, so setting the secret first (and racing it
        // against the slower refresh()) could point Stripe at a container div that doesn't
        // exist in the DOM yet (the bug this ordering fixes).
        const result = await run('pay', async () => {
            const clientSecret = (await api!.cart.checkout()).data?.client_secret ?? null
            return clientSecret
        })
        if(typeof result === 'string') {
            checkoutClientSecret.value = result
        }
        return typeof result === 'string'
    }

    async function cancelPayment() {
        const result = await run('cancel', () => api!.cart.cancelCheckout())
        if(result) {
            checkoutClientSecret.value = null
        }
        return result
    }

    function clearError() {
        error.value = null
        retryable.value = false
        unavailableProductId.value = null
    }

    function reset() {
        cart.value = null
        error.value = null
        retryable.value = false
        unavailableProductId.value = null
        checkoutClientSecret.value = null
    }

    return { cart, busy, error, retryable, unavailableProductId, checkoutClientSecret, count, locked, load, addPizza, setQty, remove, saveNote, pay, cancelPayment, clearError, reset }
})
