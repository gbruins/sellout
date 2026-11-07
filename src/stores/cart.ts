import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { api, errorDetail, errorStatus, type Cart, type CartLineData } from '@/api'
import { cartErrorMessage, type Message } from '@/utils/cartErrors'

export type { Cart, CartLineData }

export type CartBusy = 'add' | 'update' | 'remove' | 'pay' | 'cancel' | null

// Anything with a product id can be ordered: a menu product, or a cart line's product (undo)
export interface Orderable {
    id: string
}

export const NOTE_MAX = 500

// The server owns the cart: every action replaces `cart` with the server's answer and
// nothing here computes totals.
export const useCartStore = defineStore('cart', () => {
    const cart = ref<Cart | null>(null)
    // False until the first load finishes, so pages can show a skeleton instead of "empty"
    const loaded = ref(false)
    const busy = ref<CartBusy>(null)
    const error = ref<Message | null>(null)
    const unavailableProductId = ref<string | null>(null)
    // True when the last failure was a network or server error, so trying again may work
    const retryable = ref(false)
    // Set once a Checkout Session exists; EmbeddedCheckout mounts Stripe's form with it
    const checkoutClientSecret = ref<string | null>(null)

    // The kitchen note is saved on its own, outside `busy`, so saving it never blocks Pay
    const noteDraft = ref('')
    const noteStatus = ref<'idle' | 'saving' | 'saved' | 'error'>('idle')
    let noteSave: Promise<void> | null = null

    const count = computed(() => cart.value?.num_items ?? 0)
    const locked = computed(() => !!cart.value?.checkout_in_progress)
    const hasItems = computed(() => !!cart.value?.cart_items.length)
    const noteDirty = computed(() => noteDraft.value.trim() !== (cart.value?.customer_note ?? ''))

    const hasCart = () => !!api.cart.credentials().id

    function setCart(data: Cart | null) {
        const previousNote = cart.value?.customer_note ?? ''
        cart.value = data
        // Keep what the visitor is typing; only follow the server when the draft was in sync
        if(noteDraft.value.trim() === previousNote || !data) {
            noteDraft.value = data?.customer_note ?? ''
        }
    }

    async function refresh() {
        const id = api.cart.credentials().id
        const data = (await api.cart.get()).data
        // The cart was forgotten (e.g. after payment) while this request was in flight
        if(api.cart.credentials().id !== id) {
            return
        }
        setCart(data)
    }

    function fail(err: unknown) {
        error.value = cartErrorMessage(err)
        const status = errorStatus(err)
        retryable.value = !status || status >= 500
        const detail = errorDetail(err)
        if(detail?.code === 'item_unavailable') {
            unavailableProductId.value = detail.product_id ?? null
        }
        return status
    }

    // Runs one action at a time; a second tap while busy does nothing and returns false
    async function run<T>(kind: Exclude<CartBusy, null>, fn: () => Promise<T>): Promise<T | false> {
        if(busy.value) {
            return false
        }

        busy.value = kind
        clearError()

        try {
            const result = await fn()
            await refresh()
            return result
        }
        catch(err) {
            // A refused edit means this tab may be out of date, so show the server's cart
            if(fail(err) === 409) {
                try { await refresh() } catch { /* keep the message */ }
            }
            return false
        }
        finally {
            busy.value = null
        }
    }

    let loading: Promise<void> | null = null

    // Several components ask for the cart on the same page view; they share one request
    function load() {
        loading ??= (async () => {
            try {
                if(!hasCart()) {
                    setCart(null)
                    return
                }
                await refresh()
            }
            catch(err) {
                if(errorStatus(err) === 404) {
                    setCart(null)
                }
                else {
                    // Keep the cart as it was; the visitor can retry
                    fail(err)
                }
            }
            finally {
                loaded.value = true
                loading = null
            }
        })()

        return loading
    }

    async function retry() {
        clearError()
        await load()
    }

    function addPizza(pizza: Orderable, qty = 1) {
        return run('add', async () => {
            if(!hasCart()) {
                await api.cart.create()
            }
            else if(!cart.value) {
                await refresh()
            }

            const line = cart.value?.cart_items.find((i) => i.product.id === pizza.id)
            if(line) {
                await api.cart.updateItem({ id: line.id, qty: line.qty + qty })
            }
            else {
                await api.cart.addItem({ product_id: pizza.id, qty })
            }
            return true
        })
    }

    function setQty(lineId: string, qty: number) {
        return run('update', async () => {
            await api.cart.updateItem({ id: lineId, qty })
            return true
        })
    }

    function remove(lineId: string) {
        return run('remove', async () => {
            await api.cart.removeItem(lineId)
            return true
        })
    }

    // Saves the draft if it changed; waits for a save already in flight
    function saveNote(): Promise<void> {
        if(noteSave) {
            return noteSave.then(() => (noteDirty.value ? saveNote() : undefined))
        }

        if(!noteDirty.value || noteDraft.value.length > NOTE_MAX || !cart.value) {
            return Promise.resolve()
        }

        const note = noteDraft.value.trim()
        noteStatus.value = 'saving'
        noteSave = (async () => {
            try {
                await api.cart.setCustomerNote(note || null)
                if(cart.value) {
                    cart.value = { ...cart.value, customer_note: note || null }
                }
                noteStatus.value = 'saved'
            }
            catch {
                noteStatus.value = 'error'
            }
            finally {
                noteSave = null
            }
        })()

        return noteSave
    }

    // Creates (or re-fetches) the Checkout Session. The unsaved note goes first, so tapping
    // Pay straight from the note field never loses it. run() refreshes the cart before the
    // secret is stored, so `locked` (which renders the form's container) is already true when
    // EmbeddedCheckout reacts to the secret.
    async function pay(): Promise<boolean> {
        await saveNote()
        const result = await run('pay', async () => (await api.cart.checkout()).data?.client_secret ?? null)
        if(typeof result === 'string') {
            checkoutClientSecret.value = result
            return true
        }
        return false
    }

    async function cancelPayment() {
        const result = await run('cancel', () => api.cart.cancelCheckout())
        if(result) {
            checkoutClientSecret.value = null
        }
        return !!result
    }

    function clearError() {
        error.value = null
        retryable.value = false
        unavailableProductId.value = null
    }

    // After payment the server closes the cart; forget it here only if the remembered cart is
    // that closed one (another tab may already have started a new cart)
    async function forgetIfClosed() {
        if(!hasCart()) {
            return
        }
        try {
            await refresh()
        }
        catch {
            return
        }
        if(cart.value?.closed_at) {
            forget()
        }
    }

    function forget() {
        api.cart.forget()
        setCart(null)
        clearError()
        checkoutClientSecret.value = null
        noteStatus.value = 'idle'
    }

    return {
        cart, loaded, busy, error, retryable, unavailableProductId, checkoutClientSecret,
        noteDraft, noteStatus, noteDirty,
        count, locked, hasItems,
        load, retry, addPizza, setQty, remove, saveNote, pay, cancelPayment, clearError, forget, forgetIfClosed,
    }
})
