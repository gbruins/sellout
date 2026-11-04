<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { loadStripe, type StripeEmbeddedCheckout } from '@stripe/stripe-js'
import { useCartStore } from '@/stores/cart'
import { useServiceStore } from '@/stores/service'
import CartLine from '@/components/CartLine.vue'
import { formatPrice } from '@/utils/format'
import { Button } from '@/components/ui/button'

const EMBEDDED_CHECKOUT_CONTAINER_ID = 'embedded-checkout-container'

const cart = useCartStore()
const service = useServiceStore()
const noteDraft = ref('')
const NOTE_MAX = 500
const embeddedCheckoutContainer = ref<HTMLElement | null>(null)

let checkoutInstance: StripeEmbeddedCheckout | null = null

watch(() => cart.cart?.customer_note, (note) => { noteDraft.value = note ?? '' }, { immediate: true })

function saveNote() {
    if(noteDraft.value.length > NOTE_MAX || noteDraft.value.trim() === (cart.cart?.customer_note ?? '')) {
        return
    }
    cart.saveNote(noteDraft.value)
}

function destroyCheckout() {
    checkoutInstance?.destroy()
    checkoutInstance = null
}

// Mounts Stripe's Embedded Checkout inline once a client_secret exists — either just created by
// clicking Pay, or already in progress from an earlier visit (checkoutClientSecret is only
// in-memory, so a page reload needs pay() called again; the server hands back the *same*
// session rather than creating a new one, confirmed in strawberry-server's checkout tests).
watch(() => cart.checkoutClientSecret, async (clientSecret) => {
    destroyCheckout()

    if(!clientSecret) {
        return
    }

    const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
    const stripe = await loadStripe(publishableKey)
    if(!stripe || cart.checkoutClientSecret !== clientSecret) {
        return
    }

    // #embedded-checkout-container only exists once cart.locked is true (same template
    // branch). flush: 'post' (below) guarantees that DOM update has already landed before this
    // callback runs; checking the template ref here is a second, cheap guard against mounting
    // into a selector that briefly matches nothing (the exact failure Stripe's SDK throws on).
    if(!embeddedCheckoutContainer.value) {
        return
    }

    checkoutInstance = await stripe.createEmbeddedCheckoutPage({
        fetchClientSecret: () => Promise.resolve(clientSecret),
    })
    checkoutInstance.mount(`#${EMBEDDED_CHECKOUT_CONTAINER_ID}`)
}, { flush: 'post' })

onMounted(async () => {
    await Promise.all([cart.load(), service.load()])
    service.connect()

    // Locked from an earlier visit (not just-now, which the watcher above already handles) —
    // fetch the existing session's client_secret to resume rather than show a dead end.
    if(cart.locked && !cart.checkoutClientSecret) {
        await cart.pay()
    }
})

onBeforeUnmount(() => {
    service.disconnect()
    destroyCheckout()
})

// Paying and editing need an open shop with pizzas left
const closedReason = computed(() => {
    if(service.status === 'sold_out') return 'Sorry, we are sold out.'
    if(service.status === 'upcoming' || service.status === 'none') return 'The shop is not open right now.'
    return null
})
const hasItems = computed(() => !!cart.cart?.cart_items.length)

function pay() {
    return cart.pay()
}

async function cancelPayment() {
    destroyCheckout()
    await cart.cancelPayment()
    await cart.load()
}
</script>

<template>
    <section class="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6" aria-labelledby="cart-title">
        <h1 id="cart-title" class="mb-5 border-b border-border pb-3 font-heading text-2xl font-semibold text-foreground">Your cart</h1>

        <p v-if="cart.error" role="alert" data-test="cart-error" class="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {{ cart.error }}
            <Button v-if="cart.retryable" type="button" data-test="retry" variant="outline" size="sm" class="ml-2" @click="cart.clearError(); cart.load()">
                Retry
            </Button>
        </p>

        <p v-if="closedReason && hasItems" role="status" data-test="closed-reason" class="mb-4 rounded-md border border-border bg-secondary px-3 py-2 text-sm text-secondary-foreground">
            {{ closedReason }}
        </p>

        <div v-if="!hasItems" data-test="empty" class="py-10 text-center text-muted-foreground">
            <p class="mb-4">Your cart is empty.</p>
            <RouterLink to="/" class="font-semibold text-primary">Back to the menu</RouterLink>
        </div>

        <template v-else-if="cart.cart">
            <p v-if="cart.locked" role="status" data-test="locked" class="mb-4 rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm text-foreground">
                Enter your card details below to finish paying, or cancel to change your order.
            </p>

            <!-- Once locked, Stripe's own embedded form below shows its own itemized order
                 summary — hide ours so the visitor isn't shown the same line items twice. -->
            <ul v-if="!cart.locked" class="divide-y divide-border rounded-lg border border-border bg-card">
                <CartLine
                    v-for="line in cart.cart.cart_items"
                    :key="line.id"
                    :line="line"
                    :highlight="cart.unavailableProductId === line.product.id"
                />
            </ul>

            <!-- Kept visible (and editable — the backend places no restriction on it) even once
                 locked: a visitor can reach this page already locked, e.g. resuming a checkout
                 from an earlier visit, without ever having seen the unlocked view where this
                 would otherwise be their only chance to leave a note. -->
            <div class="mt-4">
                <label for="customer-note" class="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Note for the kitchen</label>
                <textarea
                    id="customer-note"
                    v-model="noteDraft"
                    data-test="note"
                    rows="3"
                    class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground disabled:opacity-60"
                    :maxlength="NOTE_MAX"
                    @blur="saveNote"
                />
                <div class="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span data-test="note-count">{{ noteDraft.length }} / {{ NOTE_MAX }}</span>
                    <Button type="button" data-test="note-save" variant="outline" size="sm" :disabled="!!cart.busy" @click="saveNote">
                        {{ cart.busy === 'note' ? 'Saving…' : 'Save note' }}
                    </Button>
                </div>
            </div>

            <div class="mt-4 flex items-center justify-between text-base text-foreground">
                <span class="font-semibold">Total</span>
                <span data-test="total" class="font-heading text-lg font-semibold text-primary">{{ formatPrice(cart.cart.grand_total) }}</span>
            </div>

            <template v-if="cart.locked">
                <p class="mt-2 text-xs text-muted-foreground" data-test="pickup">Pickup only.</p>

                <div
                    v-if="cart.busy === 'pay' && !cart.checkoutClientSecret"
                    class="mt-4 rounded-md border border-border bg-card py-10 text-center text-sm text-muted-foreground"
                >
                    Loading payment form…
                </div>
                <div ref="embeddedCheckoutContainer" :id="EMBEDDED_CHECKOUT_CONTAINER_ID" class="mt-4" data-test="embedded-checkout" />

                <Button type="button" data-test="cancel" variant="outline" class="mt-3 w-full" size="lg" :disabled="!!cart.busy" @click="cancelPayment">
                    {{ cart.busy === 'cancel' ? 'Cancelling…' : 'Cancel payment' }}
                </Button>
            </template>
            <template v-else>
                <p class="mt-2 text-xs text-muted-foreground" data-test="pickup">Pickup only.</p>

                <Button
                    type="button"
                    data-test="pay"
                    class="mt-6 w-full bg-primary text-primary-foreground hover:bg-primary/90"
                    size="lg"
                    :disabled="!!cart.busy || !!closedReason"
                    @click="pay"
                >
                    {{ cart.busy === 'pay' ? 'Opening payment…' : 'Pay' }}
                </Button>
            </template>
        </template>
    </section>
</template>
