<script setup lang="ts">
import type { CartLineData } from '@/stores/cart'
import { formatPrice } from '@/utils/format'

defineProps<{ line: CartLineData, highlight?: boolean }>()
</script>

<template>
    <li :data-test="'cart-line'" :class="['grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-l-2 px-3 py-4', highlight ? 'border-red-600 bg-red-950/30' : 'border-transparent']">
        <div class="min-w-0">
            <h3 class="truncate text-sm font-bold uppercase text-zinc-100 sm:text-base">{{ line.product.title }}</h3>
            <p class="mt-1 font-mono text-xs text-zinc-400">
                {{ formatPrice(line.product.base_price ?? NaN) }} × <span data-test="qty">{{ line.qty }}</span>
            </p>
            <slot />
        </div>
        <p class="font-mono text-sm text-orange-500" data-test="line-total">{{ formatPrice(line.price_subtotal) }}</p>
    </li>
</template>
