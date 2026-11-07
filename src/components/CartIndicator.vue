<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { ShoppingCartIcon } from '@lucide/vue'
import { useCartStore } from '@/stores/cart'
import { useServiceStore } from '@/stores/service'

const cart = useCartStore()
const service = useServiceStore()

// While closed, an empty cart has nothing to show or do — but a non-empty one (including a
// locked, mid-checkout cart) still needs a way back, regardless of service status.
const visible = computed(() => service.status === null || service.status === 'open' || cart.count > 0)
</script>

<template>
    <RouterLink
        v-if="visible"
        to="/cart"
        :aria-label="$t('cartIndicator.label', cart.count)"
        data-test="cart-indicator"
        class="-mr-2 flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-md px-2 text-foreground transition-colors hover:text-primary"
    >
        <ShoppingCartIcon class="size-5" aria-hidden="true" />
        <!-- No count until the cart has loaded, rather than a misleading 0 -->
        <span v-if="cart.loaded" data-test="cart-count" class="flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-center text-xs font-bold text-primary-foreground">{{ cart.count }}</span>
    </RouterLink>
</template>
