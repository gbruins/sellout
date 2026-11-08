<script setup lang="ts">
import { RouterLink } from 'vue-router'
import brandmarkUrl from '@/assets/sp-brandmark.svg'

const year = new Date().getFullYear()
</script>

<template>
    <footer class="border-t border-border bg-background">
        <div class="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <img :src="brandmarkUrl" :alt="$t('app.name')" class="size-8 self-start sm:self-auto" />

            <nav class="flex gap-5 text-sm" :aria-label="$t('nav.footer')">
                <RouterLink class="text-muted-foreground hover:text-primary" to="/">{{ $t('nav.home') }}</RouterLink>
                <!-- <RouterLink class="text-muted-foreground hover:text-primary" to="/about">{{ $t('nav.about') }}</RouterLink> -->
            </nav>

            <p class="text-sm text-muted-foreground">{{ $t('app.copyright', { year }) }}</p>
        </div>
    </footer>
</template>
