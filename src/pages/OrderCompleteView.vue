<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import { useOrderConfirmation } from '@/composables/useOrderConfirmation'
import { usePrice } from '@/composables/usePrice'
import PickupInfo from '@/components/PickupInfo.vue'
import { Button } from '@/components/ui/button'

// Stripe returns the customer here with ?session_id=… (see strawberry-server CheckoutService)
const route = useRoute()
const sessionId = typeof route.query.session_id === 'string' ? route.query.session_id : null

const { state, order, checkAgain } = useOrderConfirmation(sessionId)
const { formatPrice } = usePrice()
</script>

<template>
    <section class="mx-auto w-full max-w-2xl px-4 py-16 text-center sm:py-24">
        <template v-if="state === 'complete' && order">
            <h1 class="font-heading text-3xl font-semibold text-foreground sm:text-4xl">{{ $t('order.thanks') }}</h1>
            <p class="mt-3 text-muted-foreground">{{ $t('order.paid') }}</p>

            <p class="mt-8 text-sm font-medium uppercase tracking-wide text-muted-foreground">{{ $t('order.codeLabel') }}</p>
            <p data-test="pickup-code" class="mt-2 font-heading text-7xl font-bold tracking-widest text-foreground sm:text-8xl">{{ order.pickup_code }}</p>
            <p class="mt-3 text-muted-foreground">{{ $t('order.codeHint') }}</p>

            <div class="mx-auto mt-8 max-w-sm text-left">
                <PickupInfo class="mb-6 rounded-lg border border-border bg-card p-4" />

                <h2 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{{ $t('order.summary') }}</h2>
                <ul data-test="order-items" class="divide-y divide-border rounded-lg border border-border bg-card text-sm">
                    <li v-for="item in order.items" :key="item.id" class="flex justify-between gap-3 px-4 py-3">
                        <span>{{ $t('order.line', { qty: item.qty, title: item.title }) }}</span>
                        <span class="font-semibold">{{ formatPrice(item.price_subtotal) }}</span>
                    </li>
                </ul>
                <dl class="mt-3 space-y-1 px-4 text-sm">
                    <div v-if="order.sales_tax" class="flex justify-between text-muted-foreground">
                        <dt>{{ $t('order.subtotal') }}</dt>
                        <dd>{{ formatPrice(order.price_subtotal) }}</dd>
                    </div>
                    <div v-if="order.sales_tax" class="flex justify-between text-muted-foreground">
                        <dt>{{ $t('order.tax') }}</dt>
                        <dd>{{ formatPrice(order.sales_tax) }}</dd>
                    </div>
                    <div class="flex justify-between font-semibold text-foreground">
                        <dt>{{ $t('order.total') }}</dt>
                        <dd data-test="order-total">{{ formatPrice(order.grand_total) }}</dd>
                    </div>
                </dl>
            </div>

            <p v-if="order.billing_email" class="mt-6 text-sm text-muted-foreground">{{ $t('order.receipt', { email: order.billing_email }) }}</p>
        </template>

        <template v-else-if="state === 'confirming'">
            <h1 class="font-heading text-3xl font-semibold text-foreground sm:text-4xl" role="status">{{ $t('order.confirmingTitle') }}</h1>
            <p class="mt-3 text-muted-foreground">{{ $t('order.confirmingBody') }}</p>
        </template>

        <template v-else-if="state === 'slow'">
            <h1 class="font-heading text-3xl font-semibold text-foreground sm:text-4xl" role="status">{{ $t('order.slowTitle') }}</h1>
            <p class="mt-3 text-muted-foreground">{{ $t('order.slowBody') }}</p>
            <Button type="button" variant="outline" class="mt-6 h-11" data-test="check-again" @click="checkAgain">
                {{ $t('order.checkAgain') }}
            </Button>
        </template>

        <template v-else>
            <h1 class="font-heading text-3xl font-semibold text-foreground sm:text-4xl">{{ $t('order.missingTitle') }}</h1>
            <p class="mt-3 text-muted-foreground">{{ $t('order.missingBody') }}</p>
        </template>

        <RouterLink to="/" class="mt-8 block font-semibold text-primary hover:underline">{{ $t('nav.backToMenu') }}</RouterLink>
    </section>
</template>
