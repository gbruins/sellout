<script setup lang="ts">
import AppFooter from '../components/AppFooter.vue'
import AppHeader from '../components/AppHeader.vue'
</script>

<template>
    <div class="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
        <AppHeader />

        <main class="w-full flex-1 bg-zinc-950">
            <slot />
        </main>

        <AppFooter />
    </div>
</template>
