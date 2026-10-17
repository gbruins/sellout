<script setup lang="ts">
import { inject, onMounted } from 'vue';
import { useCartStore } from '@/stores/cart';

// The cart is closed by the server once Stripe confirms payment, so the
// browser's cart credentials are no longer useful.
const $api = inject<{ cart: { forget: () => void } }>('$api');

const cart = useCartStore();

onMounted(() => {
    $api?.cart.forget();
    cart.reset();
});
</script>

<template>
    <div>
        <h1>Thank you for your order!</h1>
        <p>Your payment was received.</p>
        <RouterLink to="/">Back to the menu</RouterLink>
    </div>
</template>
