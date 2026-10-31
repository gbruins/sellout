<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCartStore } from '@/stores/cart'
import { useServiceStore } from '@/stores/service'
import CartLine from '@/components/CartLine.vue'
import { formatPrice } from '@/utils/format'
import { Button } from '@/components/ui/button'

const cart = useCartStore()
const service = useServiceStore()
const route = useRoute()
const router = useRouter()
const cancelledNotice = ref(false)
const noteDraft = ref('')
const NOTE_MAX = 500

watch(() => cart.cart?.customer_note, (note) => { noteDraft.value = note ?? '' }, { immediate: true })

function saveNote() {
    if(cart.locked || noteDraft.value.length > NOTE_MAX || noteDraft.value.trim() === (cart.cart?.customer_note ?? '')) {
        return
    }
    cart.saveNote(noteDraft.value)
}

onMounted(async () => {
    if(route.query.checkout === 'cancelled') {
        cancelledNotice.value = true
        router.replace({ name: 'cart' })
    }

    await Promise.all([cart.load(), service.load()])
    service.connect()
})

onBeforeUnmount(() => service.disconnect())

// Paying and editing need an open shop with pizzas left
const closedReason = computed(() => {
    if(service.status === 'sold_out') return 'Sorry, we are sold out.'
    if(service.status === 'upcoming' || service.status === 'none') return 'The shop is not open right now.'
    return null
})
const hasItems = computed(() => !!cart.cart?.cart_items.length)

async function pay() {
    const url = await cart.pay()
    if(url) {
        window.location.assign(url)
    }
}

async function cancelPayment() {
    await cart.cancelPayment()
    await cart.load()
}
</script>

<template>
    <section class="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6" aria-labelledby="cart-title">
        <h1 id="cart-title" class="mb-5 border-b border-border pb-3 font-heading text-2xl font-semibold text-foreground">Your cart</h1>

        <p v-if="cancelledNotice" role="status" data-test="cancelled" class="mb-4 rounded-md border border-border bg-secondary px-3 py-2 text-sm text-secondary-foreground">
            Payment cancelled. Your cart is still here.
        </p>

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
                Payment in progress. Continue to payment, or cancel it to change your order.
            </p>

            <ul class="divide-y divide-border rounded-lg border border-border bg-card">
                <CartLine
                    v-for="line in cart.cart.cart_items"
                    :key="line.id"
                    :line="line"
                    :highlight="cart.unavailableProductId === line.product.id"
                />
            </ul>

            <div class="mt-4">
                <label for="customer-note" class="mb-1 block text-xs font-semibold uppercase text-muted-foreground">Note for the kitchen</label>
                <textarea
                    id="customer-note"
                    v-model="noteDraft"
                    data-test="note"
                    rows="3"
                    class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground disabled:opacity-60"
                    :maxlength="NOTE_MAX"
                    :readonly="cart.locked"
                    @blur="saveNote"
                />
                <div class="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span data-test="note-count">{{ noteDraft.length }} / {{ NOTE_MAX }}</span>
                    <Button v-if="!cart.locked" type="button" data-test="note-save" variant="outline" size="sm" :disabled="!!cart.busy" @click="saveNote">
                        {{ cart.busy === 'note' ? 'Saving…' : 'Save note' }}
                    </Button>
                </div>
            </div>

            <div class="mt-4 flex items-center justify-between text-base text-foreground">
                <span class="font-semibold">Total</span>
                <span data-test="total" class="font-heading text-lg font-semibold text-primary">{{ formatPrice(cart.cart.grand_total) }}</span>
            </div>
            <p class="mt-2 text-xs text-muted-foreground" data-test="pickup">Pickup only. Pay by card on the next page.</p>

            <template v-if="cart.locked">
                <Button type="button" data-test="continue" class="mt-6 w-full bg-primary text-primary-foreground hover:bg-primary/90" size="lg" :disabled="!!cart.busy" @click="pay">
                    {{ cart.busy === 'pay' ? 'Opening payment…' : 'Continue to payment' }}
                </Button>
                <Button type="button" data-test="cancel" variant="outline" class="mt-3 w-full" size="lg" :disabled="!!cart.busy" @click="cancelPayment">
                    {{ cart.busy === 'cancel' ? 'Cancelling…' : 'Cancel payment' }}
                </Button>
            </template>
            <Button
                v-else
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
    </section>
</template>
