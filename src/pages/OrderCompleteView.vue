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
    <div>
        <h1>Thank you for your order!</h1>
        <p>Your payment was received.</p>
        <RouterLink to="/">Back to the menu</RouterLink>
    </div>
</template>
