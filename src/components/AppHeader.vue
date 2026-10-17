<script setup lang="ts">
import StoreOpenBadge from './StoreOpenBadge.vue'
import CartIndicator from './CartIndicator.vue'
</script>

<template>
    <header class="border-b border-zinc-800 bg-zinc-950 text-zinc-100">
        <div class="mx-auto flex min-h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div class="flex min-w-0 items-center gap-4 sm:gap-6">
                <a href="/" class="truncate text-xs font-semibold uppercase text-zinc-100 sm:text-sm" aria-label="Sellout home">
                    <span class="text-orange-500">SELLOUT</span>
                    <span class="px-1.5 text-zinc-600">//</span>
                    <span class="text-zinc-300">MECHANICAL MATRIX</span>
                </a>
                <StoreOpenBadge />
            </div>

            <div class="flex shrink-0 items-center gap-4 text-xs font-medium text-zinc-400 sm:text-sm">
                <CartIndicator />
                <span>Username</span>
            </div>
        </div>
    </header>
</template>
