<script setup lang="ts">
import { computed, reactive } from 'vue'
import { ShoppingCartIcon } from '@lucide/vue'
import type { MenuProduct, ServiceMenu } from '@/stores/service'
import { formatPrice } from '@/utils/format'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { NumberField, NumberFieldContent, NumberFieldDecrement, NumberFieldIncrement, NumberFieldInput } from '@/components/ui/number-field'

const props = defineProps<{ menu: ServiceMenu | null, disabled?: boolean, maxPerOrder?: number, remaining?: number }>()

// The order event is the hand-off point for the cart UI (spec 003)
const emit = defineEmits<{
    order: [pizza: MenuProduct, qty: number]
}>()

const quantities = reactive<Record<string, number>>({})

// The actual, enforced ceiling for one click of "Order Pie" — whichever is smaller, the
// server's per-order cap or what's physically left tonight. Mirrors the server's own
// over_limit calculation (utils/cartErrors.ts) so the stepper can never be pushed past what
// the server would reject anyway.
const stepperMax = computed(() => Math.max(1, Math.min(props.maxPerOrder ?? 20, props.remaining ?? 20)))

// Menu cards show the bare number, no currency symbol — the price list is understood as
// dollars by context here; formatPrice() itself is unchanged for the cart/checkout pages,
// where an explicit $ matters.
const priceFor = (pizza: MenuProduct) => formatPrice(pizza.base_price ?? NaN).replace('$', '')

function quantityFor(pizza: MenuProduct) {
    return Math.min(quantities[pizza.id] ?? 1, stepperMax.value)
}

function onOrder(pizza: MenuProduct) {
    emit('order', pizza, quantityFor(pizza))
    quantities[pizza.id] = 1
}

if (props.menu) {
    for (const pizza of props.menu.products) {
        quantities[pizza.id] = 1
    }
}
</script>

<template>
    <section class="mx-auto w-full max-w-5xl px-4 pt-6 pb-10 sm:px-6" aria-labelledby="pizza-list-title">
        <div class="mb-6 flex items-end justify-between gap-4 border-b border-border pb-4">
            <h2 id="pizza-list-title" class="font-heading text-2xl font-semibold text-foreground sm:text-3xl">
                Menu
            </h2>
            <p v-if="maxPerOrder" class="shrink-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Max {{ maxPerOrder }} per order
            </p>
        </div>

        <p v-if="!menu || !menu.products.length" data-test="no-menu" class="rounded-lg border border-border bg-card px-3 py-8 text-center text-sm text-muted-foreground">
            Menu not available yet.
        </p>

        <ul v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <li v-for="pizza in menu.products" :key="pizza.id">
                <Card class="h-full border-border">
                    <CardContent class="flex h-full flex-col">
                        <div class="flex items-start justify-between gap-3">
                            <h3 class="font-heading text-lg font-semibold text-foreground">
                                {{ pizza.title }}
                            </h3>
                            <p class="shrink-0 font-heading text-lg font-semibold text-primary" data-test="price">{{ priceFor(pizza) }}</p>
                        </div>

                        <p v-if="pizza.description" class="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                            {{ pizza.description }}
                        </p>

                        <div class="mt-4 flex items-center gap-3 border-t border-border pt-4">
                            <NumberField
                                :model-value="quantityFor(pizza)"
                                :min="1"
                                :max="stepperMax"
                                :disabled="disabled"
                                class="w-24 shrink-0"
                                @update:model-value="(val) => { if (val) quantities[pizza.id] = val }"
                            >
                                <NumberFieldContent>
                                    <NumberFieldDecrement />
                                    <NumberFieldInput data-test="qty" />
                                    <NumberFieldIncrement />
                                </NumberFieldContent>
                            </NumberField>

                            <Button
                                type="button"
                                data-test="order"
                                class="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                                :disabled="disabled"
                                @click="onOrder(pizza)"
                            >
                                Order
                                <ShoppingCartIcon class="size-4" aria-hidden="true" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </li>
        </ul>
    </section>
</template>
