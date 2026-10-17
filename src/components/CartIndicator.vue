<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useCartStore } from '@/stores/cart'

const cart = useCartStore()
const label = computed(() => `Cart, ${cart.count} ${cart.count === 1 ? 'pizza' : 'pizzas'}`)

onMounted(() => cart.load())
</script>

<template>
    <RouterLink to="/cart" :aria-label="label" data-test="cart-indicator" class="flex items-center gap-1.5 text-zinc-100 hover:text-orange-500">
        <span class="text-xs font-semibold uppercase sm:text-sm">Cart</span>
        <span data-test="cart-count" class="min-w-5 bg-orange-600 px-1.5 text-center font-mono text-[10px] font-bold text-zinc-950">{{ cart.count }}</span>
    </RouterLink>
</template>
