<script setup lang="ts">
import type { MenuProduct } from '@/api'
import type { MenuSection } from '@/utils/menuSections'
import MenuItemCard from './MenuItemCard.vue'

// One product type's part of the menu: an optional heading (with the per-order note when the
// section is capped) and its product cards.

const props = defineProps<{
    section: MenuSection
    // Show the type heading; off when the menu has a single section
    titled?: boolean
    // Shown beside the heading of a limited section
    maxPerOrder?: number
    maxQtyFor: (product: MenuProduct) => number
    disabled?: boolean
    addingId?: string | null
}>()

const emit = defineEmits<{ order: [product: MenuProduct, qty: number] }>()

const headingId = `menu-section-${props.section.key}`
</script>

<template>
    <section :aria-labelledby="titled && section.title ? headingId : undefined" data-test="menu-section">
        <div v-if="titled && section.title" class="mb-4 flex items-end justify-between gap-4">
            <h3 :id="headingId" class="font-heading text-xl font-semibold text-foreground" data-test="section-title">
                {{ section.title }}
            </h3>
            <p v-if="maxPerOrder && section.limited" data-test="max-per-order" class="shrink-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {{ $t('menu.maxPerOrder', { n: maxPerOrder }, maxPerOrder) }}
            </p>
        </div>

        <ul class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <li v-for="product in section.products" :key="product.id">
                <MenuItemCard
                    :product="product"
                    :heading-tag="titled && section.title ? 'h4' : 'h3'"
                    :max-qty="maxQtyFor(product)"
                    :disabled="disabled"
                    :adding="addingId === product.id"
                    :unavailable="product.available === false"
                    @order="(qty) => emit('order', product, qty)"
                />
            </li>
        </ul>
    </section>
</template>
