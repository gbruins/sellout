<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { ShoppingCartIcon } from '@lucide/vue'
import { useCartStore } from '@/stores/cart'
import { usePrice } from '@/composables/usePrice'

// A persistent way to the cart on phones, where the header icon is small and scrolled away
const cart = useCartStore()
const { formatPrice } = usePrice()
</script>

<template>
    <Transition
        enter-active-class="transition duration-200 ease-out motion-reduce:transition-none"
        enter-from-class="translate-y-full opacity-0"
        leave-active-class="transition duration-150 ease-in motion-reduce:transition-none"
        leave-to-class="translate-y-full opacity-0"
    >
        <div v-if="cart.count > 0" class="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:hidden">
            <RouterLink
                to="/cart"
                data-test="mobile-cart-bar"
                class="flex h-12 items-center justify-between gap-3 rounded-lg bg-primary px-4 font-semibold text-primary-foreground"
            >
                <span class="flex items-center gap-2">
                    <ShoppingCartIcon class="size-5" aria-hidden="true" />
                    {{ $t('cartBar.label') }}
                    <span class="font-normal opacity-80">{{ $t('cartBar.count', cart.count) }}</span>
                </span>
                <span v-if="cart.cart">{{ formatPrice(cart.cart.grand_total) }}</span>
            </RouterLink>
        </div>
    </Transition>
</template>
