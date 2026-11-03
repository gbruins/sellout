<script setup lang="ts">
import { inject, onBeforeUnmount, onMounted, ref } from 'vue';
import { useCartStore } from '@/stores/cart';
import { useServiceStore } from '@/stores/service';

interface ConfirmedCart {
    closed_at: string | null
    pickup_code: number | null
    billing_email: string | null
}

interface OrderCompleteApi {
    cart: {
        get: () => Promise<{ data: ConfirmedCart }>,
        credentials: () => { id: string | null },
        forget: () => void
    }
}

const $api = inject<OrderCompleteApi>('$api');

const cart = useCartStore();
// The header badge reads the service state, so this page has to load it too (FR-013).
const service = useServiceStore();

const status = ref<'confirming' | 'ready' | 'timeout'>('confirming');
const pickupCode = ref<number | null>(null);
const billingEmail = ref<string | null>(null);

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 20000;

let pollTimer: ReturnType<typeof setTimeout> | null = null;
let stopped = false;

// The cart is closed by the server once Stripe confirms payment, so the browser's cart
// credentials are no longer useful — but not until the pickup code has actually been shown.
function finish() {
    stopped = true;

    if(pollTimer !== null) {
        clearTimeout(pollTimer);
        pollTimer = null;
    }

    $api?.cart.forget();
    cart.reset();
}

// Stripe's webhook that closes the cart (and allocates the pickup code) runs async relative to
// this redirect, so the cart may still be open on first load. There's no other polling pattern
// in this app — this is deliberately scoped to just this page, with a short timeout so a
// delayed/failed webhook doesn't block the page indefinitely.
async function poll(deadline: number) {
    if(stopped) {
        return;
    }

    try {
        const { data } = await $api!.cart.get();

        if(data.closed_at && data.pickup_code) {
            pickupCode.value = data.pickup_code;
            billingEmail.value = data.billing_email;
            status.value = 'ready';
            finish();
            return;
        }
    }
    catch {
        // Keep polling — a transient error here shouldn't abandon the attempt to show the code
    }

    if(Date.now() >= deadline) {
        status.value = 'timeout';
        finish();
        return;
    }

    pollTimer = setTimeout(() => poll(deadline), POLL_INTERVAL_MS);
}

onMounted(() => {
    service.load();
    service.connect();

    if($api?.cart.credentials().id) {
        poll(Date.now() + POLL_TIMEOUT_MS);
    }
    else {
        // Nothing to poll for (e.g. this page was reached directly, with no cart credentials)
        status.value = 'timeout';
        finish();
    }
});

onBeforeUnmount(() => {
    stopped = true;

    if(pollTimer !== null) {
        clearTimeout(pollTimer);
    }

    service.disconnect();
});
</script>

<template>
    <section class="mx-auto w-full max-w-2xl px-4 py-16 text-center sm:py-24">
        <template v-if="status === 'ready'">
            <h1 class="font-heading text-3xl font-semibold text-foreground sm:text-4xl">Thank you for your order!</h1>
            <p class="mt-3 text-muted-foreground">Your payment was received.</p>

            <p class="mt-8 text-sm font-medium uppercase tracking-wide text-muted-foreground">Your pickup code</p>
            <p class="mt-2 font-heading text-7xl font-bold tracking-widest text-foreground sm:text-8xl">{{ pickupCode }}</p>
            <p class="mt-3 text-muted-foreground">Give this number to our staff when you arrive.</p>

            <p v-if="billingEmail" class="mt-6 text-sm text-muted-foreground">A receipt was sent to {{ billingEmail }}.</p>
        </template>

        <template v-else-if="status === 'confirming'">
            <h1 class="font-heading text-3xl font-semibold text-foreground sm:text-4xl">Confirming your order...</h1>
            <p class="mt-3 text-muted-foreground">This only takes a moment.</p>
        </template>

        <template v-else>
            <h1 class="font-heading text-3xl font-semibold text-foreground sm:text-4xl">Thank you for your order!</h1>
            <p class="mt-3 text-muted-foreground">Your payment was received.</p>
        </template>

        <RouterLink to="/" class="mt-6 inline-block font-semibold text-primary hover:underline">Back to the menu</RouterLink>
    </section>
</template>
