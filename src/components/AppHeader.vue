<script setup lang="ts">
import StoreOpenBadge from './StoreOpenBadge.vue'
import CartIndicator from './CartIndicator.vue'
</script>

<template>
    <header class="border-b border-border bg-background">
        <div class="mx-auto flex min-h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
            <a href="/" class="truncate" aria-label="Sellout Pizza home">
                <span class="font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Sellout Pizza</span>
            </a>

            <div class="flex shrink-0 items-center gap-4 sm:gap-6">
                <StoreOpenBadge />
                <CartIndicator />
            </div>
        </div>
    </header>
</template>
