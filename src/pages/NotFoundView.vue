<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
    <section class="mx-auto w-full max-w-2xl px-4 py-16 text-center sm:py-24">
        <h1 class="font-heading text-3xl font-semibold text-foreground sm:text-4xl">{{ $t('notFound.title') }}</h1>
        <p class="mt-3 text-muted-foreground">{{ $t('notFound.body') }}</p>
        <RouterLink to="/" class="mt-6 inline-block font-semibold text-primary hover:underline">{{ $t('nav.backToMenu') }}</RouterLink>
    </section>
</template>
