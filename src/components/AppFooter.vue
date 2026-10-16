<script setup lang="ts">
import { RouterLink } from 'vue-router'

const currentYear = new Date().getFullYear()
</script>

<template>
    <footer class="border-t border-zinc-800 bg-zinc-950">
        <div class="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <div>
                <p class="text-sm font-semibold text-zinc-200">selloutPizza</p>
                <p class="mt-1 text-sm text-zinc-400">Fresh slices, good company.</p>
            </div>

            <nav class="flex gap-5 text-sm" aria-label="Footer navigation">
                <RouterLink class="text-zinc-400 hover:text-orange-500" to="/">Home</RouterLink>
                <RouterLink class="text-zinc-400 hover:text-orange-500" to="/about">About</RouterLink>
            </nav>

            <p class="text-sm text-zinc-500">&copy; {{ currentYear }} selloutPizza</p>
        </div>
    </footer>
</template>
