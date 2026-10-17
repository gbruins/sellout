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

    function addPizza(pizza: MenuProduct) {
        return run('add', async () => {
            if(!hasCart()) {
                await api!.cart.create()
            }
            else if(!cart.value) {
                await refresh()
            }

            const line = cart.value?.cart_items.find((i) => i.product.id === pizza.id)
            if(line) {
                await api!.cart.updateItem({ id: line.id, qty: line.qty + 1 })
            }
            else {
                await api!.cart.addItem({ product_id: pizza.id, qty: 1 })
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

    // Resolves with the Stripe URL to send the browser to
    async function pay(): Promise<string | null> {
        const result = await run('pay', async () => (await api!.cart.checkout()).data?.url ?? null, false)
        return typeof result === 'string' ? result : null
    }

    async function cancelPayment() {
        return run('cancel', () => api!.cart.cancelCheckout())
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
    }

    return { cart, busy, error, retryable, unavailableProductId, count, locked, load, addPizza, setQty, remove, saveNote, pay, cancelPayment, clearError, reset }
})
