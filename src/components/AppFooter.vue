<script setup lang="ts">
import { RouterLink } from 'vue-router'

const currentYear = new Date().getFullYear()
</script>

<template>
    <footer class="border-t border-border bg-background">
        <div class="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
                <p class="font-heading text-base font-semibold text-foreground">Sellout Pizza</p>
                <p class="mt-1 text-sm text-muted-foreground">Fresh slices, good company.</p>
            </div>

            <nav class="flex gap-5 text-sm" aria-label="Footer navigation">
                <RouterLink class="text-muted-foreground hover:text-primary" to="/">Home</RouterLink>
                <RouterLink class="text-muted-foreground hover:text-primary" to="/about">About</RouterLink>
            </nav>

            <p class="text-sm text-muted-foreground">&copy; {{ currentYear }} Sellout Pizza</p>
        </div>
    </footer>
</template>
