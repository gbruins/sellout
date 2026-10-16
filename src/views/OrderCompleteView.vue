<script setup lang="ts">
import { inject, onMounted } from 'vue';

// The cart is closed by the server once Stripe confirms payment, so the
// browser's cart credentials are no longer useful.
const $api = inject<{ cart: { forget: () => void } }>('$api');

onMounted(() => {
    $api?.cart.forget();
});
</script>

<template>
    <div>
        <h1>Thank you for your order!</h1>
        <p>Your payment was received.</p>
        <RouterLink to="/">Back to the menu</RouterLink>
    </div>
</template>
