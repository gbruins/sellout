<script setup lang="ts">
import type { MenuProduct, ServiceMenu } from '@/stores/service'
import { formatPrice } from '@/utils/format'

defineProps<{ menu: ServiceMenu | null, disabled?: boolean }>()

// The order event is the hand-off point for the cart UI (spec 003)
const emit = defineEmits<{
    order: [pizza: MenuProduct]
}>()
</script>

<template>
    <section class="mx-auto w-full max-w-4xl" aria-labelledby="pizza-list-title">
        <div class="mb-5 flex items-end justify-between gap-4 border-b border-zinc-800 pb-3 sm:mb-6">
            <div>
                <p class="mb-1 font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-orange-500">
                    Tonight's selection
                </p>
                <h2 id="pizza-list-title" class="text-xl font-bold uppercase text-zinc-100 sm:text-2xl">
                    {{ menu?.title || 'Menu' }}
                </h2>
            </div>
            <p class="hidden font-mono text-[10px] uppercase tracking-wider text-zinc-500 sm:block">
                Made fresh to order
            </p>
        </div>

        <p v-if="!menu || !menu.products.length" data-test="no-menu" class="border-y border-zinc-800 px-3 py-8 text-center text-sm text-zinc-400">
            Menu not available yet.
        </p>

        <ul v-else class="divide-y divide-zinc-800 border-y border-zinc-800">
            <li v-for="pizza in menu.products" :key="pizza.id" class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-l-2 border-transparent px-3 py-5 transition-colors duration-200 hover:border-l-orange-500 hover:bg-zinc-900 sm:gap-8 sm:py-6">
                <div class="min-w-0">
                    <h3 class="text-base font-bold uppercase leading-tight text-zinc-100 sm:text-lg">
                        {{ pizza.title }}
                    </h3>
                    <p v-if="pizza.description" class="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
                        {{ pizza.description }}
                    </p>
                    <p class="mt-2 font-mono text-xs text-orange-500" data-test="price">{{ formatPrice(pizza.base_price ?? NaN) }}</p>
                </div>

                <button
                    class="shrink-0 border border-orange-700 px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-wider text-orange-500 transition-colors hover:bg-orange-600 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 sm:px-4 sm:text-[10px]"
                    type="button"
                    :disabled="disabled"
                    @click="emit('order', pizza)"
                >
                    Order now
                </button>
            </li>
        </ul>
    </section>
</template>
