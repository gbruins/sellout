<script setup lang="ts">
import { onMounted } from 'vue'
import AppFooter from '@/components/AppFooter.vue'
import AppHeader from '@/components/AppHeader.vue'
import CartResetNotice from '@/components/CartResetNotice.vue'
import { useLiveServiceStatus } from '@/composables/useLiveServiceStatus'
import { useCartStore } from '@/stores/cart'

// The layout outlives route changes, so live status and the cart load once per visit here,
// not once per page
useLiveServiceStatus()

const cart = useCartStore()
onMounted(() => cart.load())
</script>

<template>
    <div class="flex min-h-screen flex-col bg-background text-foreground">
        <AppHeader />
        <CartResetNotice />

        <main class="w-full flex-1">
            <slot />
        </main>

        <AppFooter />
    </div>
</template>
