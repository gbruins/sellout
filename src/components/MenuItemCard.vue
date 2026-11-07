<script setup lang="ts">
import { computed, ref } from 'vue'
import { Loader2Icon, ShoppingCartIcon } from '@lucide/vue'
import type { MenuProduct } from '@/api'
import { usePrice } from '@/composables/usePrice'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { NumberField, NumberFieldContent, NumberFieldDecrement, NumberFieldIncrement, NumberFieldInput } from '@/components/ui/number-field'

const props = defineProps<{
    product: MenuProduct
    // The enforced ceiling for one order: the smaller of the per-order cap and what's left
    maxQty: number
    disabled?: boolean
    // This card's own order is in flight (others are only disabled)
    adding?: boolean
}>()

const emit = defineEmits<{ order: [qty: number] }>()

const { formatPrice } = usePrice()

const qty = ref(1)
const clampedQty = computed(() => Math.min(Math.max(qty.value, 1), props.maxQty))

function order() {
    emit('order', clampedQty.value)
    qty.value = 1
}
</script>

<template>
    <Card class="relative h-full overflow-hidden border-border pt-0" :class="{ 'card-adding': adding }" :data-adding="adding || undefined">
        <img
            v-if="product.image"
            :src="product.image"
            alt=""
            loading="lazy"
            data-test="product-image"
            class="aspect-4/3 w-full object-cover"
        >
        <CardContent class="flex h-full flex-col" :class="{ 'pt-6': !product.image }">
            <div class="flex items-start justify-between gap-3">
                <h3 class="font-heading text-lg font-semibold text-foreground">
                    {{ product.title }}
                </h3>
                <p class="shrink-0 font-heading text-lg font-semibold text-primary" data-test="price">{{ formatPrice(product.base_price) }}</p>
            </div>

            <p v-if="product.description" class="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                {{ product.description }}
            </p>

            <div class="mt-4 flex items-center gap-3 border-t border-border pt-4">
                <NumberField
                    :model-value="clampedQty"
                    :min="1"
                    :max="maxQty"
                    :disabled="disabled"
                    class="w-28 shrink-0"
                    @update:model-value="(val) => { if (val) qty = val }"
                >
                    <NumberFieldContent>
                        <NumberFieldDecrement :aria-label="$t('cart.decrease', { title: product.title })" />
                        <NumberFieldInput data-test="qty" class="h-11" :aria-label="$t('menu.quantityFor', { title: product.title })" />
                        <NumberFieldIncrement :aria-label="$t('cart.increase', { title: product.title })" />
                    </NumberFieldContent>
                </NumberField>

                <Button
                    type="button"
                    data-test="order"
                    class="h-11 flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                    :disabled="disabled"
                    :aria-busy="adding"
                    :aria-label="$t('menu.orderItem', { title: product.title })"
                    @click="order"
                >
                    <template v-if="adding">
                        <Loader2Icon class="size-4 animate-spin" aria-hidden="true" />
                        {{ $t('menu.adding') }}
                    </template>
                    <template v-else>
                        {{ $t('menu.order') }}
                        <ShoppingCartIcon class="size-4" aria-hidden="true" />
                    </template>
                </Button>
            </div>
        </CardContent>
    </Card>
</template>

<style scoped>
/* While this card's order is in flight, a light travels around its edge. Drawn as an overlay
   (a masked gradient ring) on top of the card's own 1px ring, so nothing shifts in layout. */
@property --border-angle {
    syntax: '<angle>';
    inherits: false;
    initial-value: 0deg;
}

.card-adding::after {
    content: '';
    position: absolute;
    inset: 0;
    padding: 2px;
    border-radius: inherit;
    pointer-events: none;
    background: conic-gradient(
        from var(--border-angle),
        transparent 0deg 200deg,
        var(--primary) 300deg,
        var(--gold) 345deg,
        transparent 360deg
    );
    /* Keep only the padding area: the ring */
    -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
    -webkit-mask-composite: xor;
    mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0);
    animation: border-travel 1.2s linear infinite;
}

@keyframes border-travel {
    to {
        --border-angle: 360deg;
    }
}

/* No motion: a steady highlighted border instead of a moving one */
@media (prefers-reduced-motion: reduce) {
    .card-adding::after {
        animation: none;
        background: var(--primary);
    }
}
</style>
