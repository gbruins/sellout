<script setup lang="ts">
import { RouterLink } from 'vue-router'

const year = new Date().getFullYear()
</script>

<template>
    <footer class="border-t border-border bg-background">
        <div class="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
                <p class="font-heading text-base font-semibold text-foreground">{{ $t('app.name') }}</p>
                <p class="mt-1 text-sm text-muted-foreground">{{ $t('app.tagline') }}</p>
            </div>

            <nav class="flex gap-5 text-sm" :aria-label="$t('nav.footer')">
                <RouterLink class="text-muted-foreground hover:text-primary" to="/">{{ $t('nav.home') }}</RouterLink>
                <RouterLink class="text-muted-foreground hover:text-primary" to="/about">{{ $t('nav.about') }}</RouterLink>
            </nav>

            <p class="text-sm text-muted-foreground">{{ $t('app.copyright', { year }) }}</p>
        </div>
    </footer>
</template>
