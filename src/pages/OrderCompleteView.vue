<script setup lang="ts">
import { inject, onBeforeUnmount, onMounted } from 'vue';
import { useCartStore } from '@/stores/cart';
import { useServiceStore } from '@/stores/service';

// The cart is closed by the server once Stripe confirms payment, so the
// browser's cart credentials are no longer useful.
const $api = inject<{ cart: { forget: () => void } }>('$api');

const cart = useCartStore();
// The header badge reads the service state, so this page has to load it too (FR-013).
const service = useServiceStore();

onMounted(() => {
    $api?.cart.forget();
    cart.reset();
    service.load();
    service.connect();
});

onBeforeUnmount(() => service.disconnect());
</script>

<template>
    <section class="mx-auto w-full max-w-2xl px-4 py-16 text-center sm:py-24">
        <h1 class="font-heading text-3xl font-semibold text-foreground sm:text-4xl">Thank you for your order!</h1>
        <p class="mt-3 text-muted-foreground">Your payment was received.</p>
        <RouterLink to="/" class="mt-6 inline-block font-semibold text-primary hover:underline">Back to the menu</RouterLink>
    </section>
</template>
