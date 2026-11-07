<script setup lang="ts">
import { ref, toRef } from 'vue'
import { useStripeEmbeddedCheckout } from '@/composables/useStripeEmbeddedCheckout'

// Stripe's own payment form, inline on our page (not a redirect to a Stripe-hosted one)
const props = defineProps<{ clientSecret: string | null }>()

const container = ref<HTMLElement | null>(null)
const { mounted } = useStripeEmbeddedCheckout(container, toRef(props, 'clientSecret'))
</script>

<template>
    <div class="mt-4">
        <div v-if="!mounted" class="rounded-md border border-border bg-card py-10 text-center text-sm text-muted-foreground" role="status">
            {{ $t('cart.loadingPayment') }}
        </div>
        <div ref="container" data-test="embedded-checkout" />
    </div>
</template>
