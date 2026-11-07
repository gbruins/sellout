<script setup lang="ts">
import { computed } from 'vue'
import type { MenuProduct, ServiceMenu } from '@/api'
import { groupMenuProducts, isLimited } from '@/utils/menuSections'
import MenuSection from './MenuSection.vue'

const props = defineProps<{
    menu: ServiceMenu | null
    disabled?: boolean
    maxPerOrder?: number
    remaining?: number
    // The product whose order is in flight, so only its card shows progress
    addingId?: string | null
}>()

const emit = defineEmits<{ order: [product: MenuProduct, qty: number] }>()

// The stepper's ceiling when nothing tighter applies
const UNLIMITED_QTY = 20

// Mirrors the server's own over_limit calculation, so the stepper can never be pushed past
// what the server would reject anyway. Only pizzas (`limited`) count toward the cap and stock.
const limitedMaxQty = computed(() => Math.max(1, Math.min(props.maxPerOrder ?? UNLIMITED_QTY, props.remaining ?? UNLIMITED_QTY)))
const maxQtyFor = (product: MenuProduct) => isLimited(product) ? limitedMaxQty.value : UNLIMITED_QTY

// One section per product type, in menu order. A single section is shown without a heading,
// exactly like a plain list.
const sections = computed(() => groupMenuProducts(props.menu?.products ?? []))
const titled = computed(() => sections.value.length > 1)

// With one section the per-order note sits in the page header; otherwise on the Pizza heading
const headerNote = computed(() => !titled.value && !!props.maxPerOrder && sections.value.some((s) => s.limited))
</script>

<template>
    <section class="mx-auto w-full max-w-5xl px-4 pt-6 pb-10 sm:px-6" aria-labelledby="pizza-list-title">
        <div class="mb-6 flex items-end justify-between gap-4 border-b border-border pb-4">
            <h2 id="pizza-list-title" class="font-heading text-2xl font-semibold text-foreground sm:text-3xl">
                {{ $t('menu.title') }}
            </h2>
            <p v-if="headerNote && maxPerOrder" data-test="max-per-order" class="shrink-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {{ $t('menu.maxPerOrder', { n: maxPerOrder }, maxPerOrder) }}
            </p>
        </div>

        <p v-if="!sections.length" data-test="no-menu" class="rounded-lg border border-border bg-card px-3 py-8 text-center text-sm text-muted-foreground">
            {{ $t('menu.unavailable') }}
        </p>

        <div v-else class="space-y-10">
            <MenuSection
                v-for="section in sections"
                :key="section.key"
                :section="section"
                :titled="titled"
                :max-per-order="titled ? maxPerOrder : undefined"
                :max-qty-for="maxQtyFor"
                :disabled="disabled"
                :adding-id="addingId"
                @order="(product, qty) => emit('order', product, qty)"
            />
        </div>
    </section>
</template>
