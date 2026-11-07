<script setup lang="ts">
import { computed } from 'vue'
import type { MenuProduct, ServiceMenu } from '@/api'
import MenuItemCard from './MenuItemCard.vue'

const props = defineProps<{
    menu: ServiceMenu | null
    disabled?: boolean
    maxPerOrder?: number
    remaining?: number
    // The product whose order is in flight, so only its card shows progress
    addingId?: string | null
}>()

const emit = defineEmits<{ order: [pizza: MenuProduct, qty: number] }>()

// Mirrors the server's own over_limit calculation, so the stepper can never be pushed past
// what the server would reject anyway
const maxQty = computed(() => Math.max(1, Math.min(props.maxPerOrder ?? 20, props.remaining ?? 20)))
</script>

<template>
    <section class="mx-auto w-full max-w-5xl px-4 pt-6 pb-10 sm:px-6" aria-labelledby="pizza-list-title">
        <div class="mb-6 flex items-end justify-between gap-4 border-b border-border pb-4">
            <h2 id="pizza-list-title" class="font-heading text-2xl font-semibold text-foreground sm:text-3xl">
                {{ $t('menu.title') }}
            </h2>
            <p v-if="maxPerOrder" class="shrink-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {{ $t('menu.maxPerOrder', { n: maxPerOrder }) }}
            </p>
        </div>

        <p v-if="!menu || !menu.products.length" data-test="no-menu" class="rounded-lg border border-border bg-card px-3 py-8 text-center text-sm text-muted-foreground">
            {{ $t('menu.unavailable') }}
        </p>

        <ul v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <li v-for="pizza in menu.products" :key="pizza.id">
                <MenuItemCard
                    :product="pizza"
                    :max-qty="maxQty"
                    :disabled="disabled"
                    :adding="addingId === pizza.id"
                    @order="(qty) => emit('order', pizza, qty)"
                />
            </li>
        </ul>
    </section>
</template>
