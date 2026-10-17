<script setup lang="ts">
import { onMounted } from 'vue'
import { useCartStore } from '@/stores/cart'
import CartLine from '@/components/CartLine.vue'
import { formatPrice } from '@/utils/format'

const cart = useCartStore()

onMounted(() => cart.load())

async function pay() {
    const url = await cart.pay()
    if(url) {
        window.location.assign(url)
    }
}
</script>

<template>
    <section class="mx-auto w-full max-w-2xl px-3 py-6" aria-labelledby="cart-title">
        <h1 id="cart-title" class="mb-4 border-b border-zinc-800 pb-3 text-xl font-bold uppercase text-zinc-100">Your cart</h1>

        <p v-if="cart.error" role="alert" data-test="cart-error" class="mb-4 border border-red-800 px-3 py-2 text-sm text-red-300">{{ cart.error }}</p>

        <div v-if="!cart.cart || !cart.cart.cart_items.length" data-test="empty" class="py-10 text-center text-zinc-400">
            <p class="mb-4">Your cart is empty.</p>
            <RouterLink to="/" class="font-semibold uppercase text-orange-500">Back to the menu</RouterLink>
        </div>

        <template v-else>
            <ul class="divide-y divide-zinc-800 border-y border-zinc-800">
                <CartLine
                    v-for="line in cart.cart.cart_items"
                    :key="line.id"
                    :line="line"
                    :highlight="cart.unavailableProductId === line.product.id"
                />
            </ul>

            <div class="mt-4 flex items-center justify-between font-mono text-base text-zinc-100">
                <span class="uppercase">Total</span>
                <span data-test="total">{{ formatPrice(cart.cart.grand_total) }}</span>
            </div>
            <p class="mt-2 text-xs text-zinc-400" data-test="pickup">Pickup only. Pay by card on the next page.</p>

            <button
                type="button"
                data-test="pay"
                class="mt-6 w-full bg-orange-600 px-4 py-3 text-sm font-bold uppercase text-zinc-950 disabled:opacity-50"
                :disabled="!!cart.busy"
                @click="pay"
            >
                {{ cart.busy === 'pay' ? 'Opening payment…' : 'Pay' }}
            </button>
        </template>
    </section>
</template>
