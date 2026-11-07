<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { MinusIcon, PlusIcon } from '@lucide/vue'
import { useCartStore, type CartLineData } from '@/stores/cart'
import { usePrice } from '@/composables/usePrice'

const props = defineProps<{ line: CartLineData, highlight?: boolean }>()

const cart = useCartStore()
const { t } = useI18n()
const { formatPrice } = usePrice()

const title = computed(() => props.line.product.title)

// Removing is one tap, so it's undoable: Undo orders the same pizza and quantity again
async function remove() {
    const { product, qty } = props.line
    if(await cart.remove(props.line.id)) {
        toast(t('cart.removed', { title: product.title }), {
            action: { label: t('common.undo'), onClick: () => cart.addPizza(product, qty) },
        })
    }
}

// Minus at 1 removes the line; the server decides every resulting quantity
const minus = () => props.line.qty <= 1 ? remove() : cart.setQty(props.line.id, props.line.qty - 1)
const plus = () => cart.setQty(props.line.id, props.line.qty + 1)

const stepButton = 'flex size-11 items-center justify-center rounded-md border border-border text-foreground hover:border-primary hover:text-primary disabled:opacity-40'
</script>

<template>
    <li data-test="cart-line" :class="['grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-l-2 px-3 py-4', highlight ? 'border-destructive bg-destructive/5' : 'border-transparent']">
        <div class="min-w-0">
            <h3 class="truncate font-heading text-base font-semibold text-foreground">{{ title }}</h3>
            <p class="mt-1 text-xs text-muted-foreground">
                {{ $t('cart.unitPrice', { price: formatPrice(line.product.base_price), qty: line.qty }) }}
            </p>

            <div v-if="!cart.locked" class="mt-2 flex items-center gap-2">
                <button type="button" data-test="minus" :class="stepButton" :disabled="!!cart.busy" :aria-label="$t('cart.decrease', { title })" @click="minus">
                    <MinusIcon class="size-4" aria-hidden="true" />
                </button>
                <span data-test="qty" class="min-w-6 text-center text-sm text-foreground" aria-live="polite">{{ line.qty }}</span>
                <button type="button" data-test="plus" :class="stepButton" :disabled="!!cart.busy" :aria-label="$t('cart.increase', { title })" @click="plus">
                    <PlusIcon class="size-4" aria-hidden="true" />
                </button>
                <button
                    type="button"
                    data-test="remove"
                    class="ml-1 min-h-11 px-2 text-xs font-semibold uppercase text-muted-foreground underline hover:text-primary disabled:opacity-50"
                    :disabled="!!cart.busy"
                    :aria-label="$t('cart.removeLabel', { title })"
                    @click="remove"
                >
                    {{ $t('cart.remove') }}
                </button>
            </div>
        </div>
        <p class="text-sm font-semibold text-primary" data-test="line-total">{{ formatPrice(line.price_subtotal) }}</p>
    </li>
</template>
