<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { ShoppingCartIcon } from '@lucide/vue'
import { useCartStore } from '@/stores/cart'
import { useServiceStore } from '@/stores/service'

const cart = useCartStore()
const service = useServiceStore()
const label = computed(() => `Cart, ${cart.count} ${cart.count === 1 ? 'pizza' : 'pizzas'}`)

// While closed, an empty cart has nothing to show or do — but a non-empty one (including a
// locked, mid-checkout cart) still needs a way back, regardless of service status.
const visible = computed(() => service.status === null || service.status === 'open' || cart.count > 0)

onMounted(() => cart.load())
</script>

<template>
    <RouterLink v-if="visible" to="/cart" :aria-label="label" data-test="cart-indicator" class="flex items-center gap-1.5 text-foreground transition-colors hover:text-primary">
        <ShoppingCartIcon class="size-4" aria-hidden="true" />
        <span data-test="cart-count" class="flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-center text-[11px] font-bold text-primary-foreground">{{ cart.count }}</span>
    </RouterLink>
</template>
