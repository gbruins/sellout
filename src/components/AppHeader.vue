<script setup lang="ts">
import { RouterLink } from 'vue-router'
import StoreOpenBadge from './StoreOpenBadge.vue'
import CartIndicator from './CartIndicator.vue'
import logoUrl from '@/assets/sp-logo.svg'
</script>

<template>
    <header class="border-b border-border bg-background">
        <div class="mx-auto flex min-h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
            <RouterLink to="/" class="min-w-0 shrink" :aria-label="$t('app.homeLabel')">
                <img :src="logoUrl" :alt="$t('app.name')" class="h-9 w-auto max-w-full" />
            </RouterLink>

            <div class="flex shrink-0 items-center gap-2 sm:gap-4">
                <StoreOpenBadge />
                <CartIndicator />
            </div>
        </div>
    </header>
</template>
