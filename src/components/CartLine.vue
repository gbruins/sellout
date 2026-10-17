<script setup lang="ts">
import { computed } from 'vue'
import type { CartLineData } from '@/stores/cart'
import { useCartStore } from '@/stores/cart'
import { formatPrice } from '@/utils/format'

const props = defineProps<{ line: CartLineData, highlight?: boolean }>()

const cart = useCartStore()
const editable = computed(() => !cart.locked)
const title = computed(() => props.line.product.title)

// Minus at 1 removes the line; the server decides every resulting quantity
const minus = () => props.line.qty <= 1 ? cart.remove(props.line.id) : cart.setQty(props.line.id, props.line.qty - 1)
const plus = () => cart.setQty(props.line.id, props.line.qty + 1)

const btn = 'h-8 w-8 border border-zinc-600 font-mono text-base text-zinc-100 hover:border-orange-500 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-orange-500'
</script>

<template>
    <li data-test="cart-line" :class="['grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-l-2 px-3 py-4', highlight ? 'border-red-600 bg-red-950/30' : 'border-transparent']">
        <div class="min-w-0">
            <h3 class="truncate text-sm font-bold uppercase text-zinc-100 sm:text-base">{{ title }}</h3>
            <p class="mt-1 font-mono text-xs text-zinc-400">
                {{ formatPrice(line.product.base_price ?? NaN) }} × <span data-test="qty">{{ line.qty }}</span>
            </p>

            <div v-if="editable" class="mt-2 flex items-center gap-2">
                <button type="button" data-test="minus" :class="btn" :disabled="!!cart.busy" :aria-label="`Remove one ${title}`" @click="minus">−</button>
                <span class="min-w-6 text-center font-mono text-sm text-zinc-100" aria-live="polite">{{ line.qty }}</span>
                <button type="button" data-test="plus" :class="btn" :disabled="!!cart.busy" :aria-label="`Add one ${title}`" @click="plus">+</button>
                <button type="button" data-test="remove" class="ml-2 text-xs font-semibold uppercase text-zinc-400 underline hover:text-orange-500 disabled:opacity-50" :disabled="!!cart.busy" :aria-label="`Remove ${title} from cart`" @click="cart.remove(line.id)">
                    Remove
                </button>
            </div>
        </div>
        <p class="font-mono text-sm text-orange-500" data-test="line-total">{{ formatPrice(line.price_subtotal) }}</p>
    </li>
</template>
