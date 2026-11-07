<script setup lang="ts">
import { RouterLink } from 'vue-router'
import StoreOpenBadge from './StoreOpenBadge.vue'
import CartIndicator from './CartIndicator.vue'
</script>

<template>
    <header class="border-b border-border bg-background">
        <div class="mx-auto flex min-h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
            <RouterLink to="/" class="truncate" :aria-label="$t('app.homeLabel')">
                <span class="font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{{ $t('app.name') }}</span>
            </RouterLink>

            <div class="flex shrink-0 items-center gap-2 sm:gap-4">
                <StoreOpenBadge />
                <CartIndicator />
            </div>
        </div>
    </header>
</template>
