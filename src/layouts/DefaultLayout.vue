<script setup lang="ts">
import AppFooter from '../components/AppFooter.vue'
import AppHeader from '../components/AppHeader.vue'
import CartResetNotice from '../components/CartResetNotice.vue'
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
