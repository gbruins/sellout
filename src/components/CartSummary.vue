<script setup lang="ts">
import { computed } from 'vue'
import { useCartStore } from '@/stores/cart'
import { usePrice } from '@/composables/usePrice'
import { Button } from '@/components/ui/button'
import EmbeddedCheckout from './EmbeddedCheckout.vue'
import PickupInfo from './PickupInfo.vue'

// Total, pickup details, and the way to pay (or the payment form itself once paying)
defineProps<{ payDisabled?: boolean }>()

const cart = useCartStore()
const { formatPrice } = usePrice()

const total = computed(() => formatPrice(cart.cart?.grand_total))
</script>

<template>
    <div>
        <div class="mt-4 flex items-center justify-between text-base text-foreground">
            <span class="font-semibold">{{ $t('cart.total') }}</span>
            <span data-test="total" class="font-heading text-lg font-semibold text-primary">{{ total }}</span>
        </div>

        <p class="mt-2 text-xs text-muted-foreground" data-test="pickup">{{ $t('pickup.only') }}</p>
        <PickupInfo compact class="mt-3" />

        <template v-if="cart.locked">
            <EmbeddedCheckout v-if="cart.checkoutClientSecret || cart.busy === 'pay'" :client-secret="cart.checkoutClientSecret" />

            <Button type="button" data-test="cancel" variant="outline" class="mt-3 h-11 w-full" :disabled="!!cart.busy" @click="cart.cancelPayment()">
                {{ cart.busy === 'cancel' ? $t('cart.cancelling') : $t('cart.cancel') }}
            </Button>
        </template>

        <Button
            v-else
            type="button"
            data-test="pay"
            class="mt-6 h-12 w-full bg-primary text-base text-primary-foreground hover:bg-primary/90"
            :disabled="!!cart.busy || payDisabled"
            @click="cart.pay()"
        >
            {{ cart.busy === 'pay' ? $t('cart.opening') : $t('cart.pay', { total }) }}
        </Button>
    </div>
</template>
