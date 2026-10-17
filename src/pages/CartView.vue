<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCartStore } from '@/stores/cart'
import { useServiceStore } from '@/stores/service'
import CartLine from '@/components/CartLine.vue'
import { formatPrice } from '@/utils/format'

const cart = useCartStore()
const service = useServiceStore()
const route = useRoute()
const router = useRouter()
const cancelledNotice = ref(false)

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
    <section class="mx-auto w-full max-w-2xl px-3 py-6" aria-labelledby="cart-title">
        <h1 id="cart-title" class="mb-4 border-b border-zinc-800 pb-3 text-xl font-bold uppercase text-zinc-100">Your cart</h1>

        <p v-if="cancelledNotice" role="status" data-test="cancelled" class="mb-4 border border-zinc-700 px-3 py-2 text-sm text-zinc-200">
            Payment cancelled. Your cart is still here.
        </p>

        <p v-if="cart.error" role="alert" data-test="cart-error" class="mb-4 border border-red-800 px-3 py-2 text-sm text-red-300">
            {{ cart.error }}
            <button v-if="cart.retryable" type="button" data-test="retry" class="ml-2 border border-orange-700/70 px-3 py-1 text-xs font-semibold uppercase text-orange-500" @click="cart.clearError(); cart.load()">
                Retry
            </button>
        </p>

        <p v-if="closedReason && hasItems" role="status" data-test="closed-reason" class="mb-4 border border-zinc-700 px-3 py-2 text-sm text-zinc-200">
            {{ closedReason }}
        </p>

        <div v-if="!hasItems" data-test="empty" class="py-10 text-center text-zinc-400">
            <p class="mb-4">Your cart is empty.</p>
            <RouterLink to="/" class="font-semibold uppercase text-orange-500">Back to the menu</RouterLink>
        </div>

        <template v-else-if="cart.cart">
            <p v-if="cart.locked" role="status" data-test="locked" class="mb-4 border border-orange-700 px-3 py-2 text-sm text-zinc-100">
                Payment in progress. Continue to payment, or cancel it to change your order.
            </p>

            <ul class="divide-y divide-zinc-800 border-y border-zinc-800">
                <CartLine
                    v-for="line in cart.cart.cart_items"
                    :key="line.id"
                    :line="line"
                    :highlight="cart.unavailableProductId === line.product.id"
                >
                    <button
                        v-if="!cart.locked"
                        type="button"
                        data-test="remove"
                        class="mt-2 text-xs font-semibold uppercase text-zinc-400 underline hover:text-orange-500 disabled:opacity-50"
                        :disabled="!!cart.busy"
                        @click="cart.remove(line.id)"
                    >
                        Remove
                    </button>
                </CartLine>
            </ul>

            <div class="mt-4 flex items-center justify-between font-mono text-base text-zinc-100">
                <span class="uppercase">Total</span>
                <span data-test="total">{{ formatPrice(cart.cart.grand_total) }}</span>
            </div>
            <p class="mt-2 text-xs text-zinc-400" data-test="pickup">Pickup only. Pay by card on the next page.</p>

            <template v-if="cart.locked">
                <button type="button" data-test="continue" class="mt-6 w-full bg-orange-600 px-4 py-3 text-sm font-bold uppercase text-zinc-950 disabled:opacity-50" :disabled="!!cart.busy" @click="pay">
                    {{ cart.busy === 'pay' ? 'Opening payment…' : 'Continue to payment' }}
                </button>
                <button type="button" data-test="cancel" class="mt-3 w-full border border-zinc-600 px-4 py-3 text-sm font-bold uppercase text-zinc-200 disabled:opacity-50" :disabled="!!cart.busy" @click="cancelPayment">
                    {{ cart.busy === 'cancel' ? 'Cancelling…' : 'Cancel payment' }}
                </button>
            </template>
            <button
                v-else
                type="button"
                data-test="pay"
                class="mt-6 w-full bg-orange-600 px-4 py-3 text-sm font-bold uppercase text-zinc-950 disabled:opacity-50"
                :disabled="!!cart.busy || !!closedReason"
                @click="pay"
            >
                {{ cart.busy === 'pay' ? 'Opening payment…' : 'Pay' }}
            </button>
        </template>
    </section>
</template>
