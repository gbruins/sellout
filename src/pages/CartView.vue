<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useCartStore } from '@/stores/cart'
import { useServiceStore } from '@/stores/service'
import CartLine from '@/components/CartLine.vue'
import CartSummary from '@/components/CartSummary.vue'
import InlineAlert from '@/components/InlineAlert.vue'
import KitchenNoteField from '@/components/KitchenNoteField.vue'
import { Button } from '@/components/ui/button'

const cart = useCartStore()
const service = useServiceStore()

onMounted(async () => {
    await cart.load()

    // Locked from an earlier visit — fetch the existing session's client_secret to resume
    // rather than show a dead end (the server hands back the same session)
    if(cart.locked && !cart.checkoutClientSecret) {
        await cart.pay()
    }
})

// Paying and editing need an open shop with pizzas left
const closedReason = computed(() => {
    if(service.status === 'sold_out') return 'errors.soldOut'
    if(service.status === 'upcoming' || service.status === 'none') return 'errors.notOpen'
    return null
})
</script>

<template>
    <section class="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6" aria-labelledby="cart-title">
        <h1 id="cart-title" class="mb-5 border-b border-border pb-3 font-heading text-2xl font-semibold text-foreground">{{ $t('cart.title') }}</h1>

        <InlineAlert v-if="cart.error" variant="error" data-test="cart-error" class="mb-4">
            {{ $t(cart.error.key, cart.error.params ?? {}, cart.error.plural ?? 1) }}
            <template v-if="cart.retryable" #action>
                <Button type="button" data-test="retry" variant="outline" size="sm" @click="cart.retry()">
                    {{ $t('common.retry') }}
                </Button>
            </template>
        </InlineAlert>

        <div v-if="!cart.loaded" data-test="cart-loading" class="space-y-3" role="status" :aria-label="$t('cart.loading')">
            <div class="h-24 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
            <div class="h-20 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
        </div>

        <div v-else-if="!cart.hasItems" data-test="empty" class="py-10 text-center text-muted-foreground">
            <p class="mb-4">{{ $t('cart.empty') }}</p>
            <RouterLink to="/" class="font-semibold text-primary">{{ $t('nav.backToMenu') }}</RouterLink>
        </div>

        <template v-else-if="cart.cart">
            <InlineAlert v-if="closedReason" data-test="closed-reason" class="mb-4">
                {{ $t(closedReason) }}
            </InlineAlert>

            <InlineAlert v-if="cart.locked" variant="notice" data-test="locked" class="mb-4">
                {{ $t('cart.locked') }}
            </InlineAlert>

            <!-- Once locked, Stripe's embedded form shows its own itemized summary — hide ours
                 so the visitor isn't shown the same line items twice -->
            <template v-if="!cart.locked">
                <ul class="divide-y divide-border rounded-lg border border-border bg-card">
                    <CartLine
                        v-for="line in cart.cart.cart_items"
                        :key="line.id"
                        :line="line"
                        :highlight="cart.unavailableProductId === line.product.id"
                    />
                </ul>
                <RouterLink to="/" data-test="add-more" class="mt-3 inline-block text-sm font-semibold text-primary hover:underline">
                    {{ $t('cart.addMore') }}
                </RouterLink>
            </template>

            <!-- Editable even once locked: a visitor can arrive here already paying (resuming
                 an earlier visit) without ever having seen the unlocked view -->
            <KitchenNoteField class="mt-4" />

            <CartSummary :pay-disabled="!!closedReason" />
        </template>
    </section>
</template>
