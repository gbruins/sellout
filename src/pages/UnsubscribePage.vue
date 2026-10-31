<script setup lang="ts">
import { inject, onMounted } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const $api = inject<{ subscribe: { unsubscribe: (token: string) => Promise<unknown> } }>('$api')

onMounted(() => {
    const token = route.query.token
    if (typeof token === 'string') {
        $api?.subscribe.unsubscribe(token)
    }
})
</script>

<template>
    <section class="mx-auto w-full max-w-2xl px-4 py-12 text-center sm:py-16">
        <div class="rounded-lg border border-border bg-card px-4 py-10 sm:px-8">
            <h1 class="font-heading text-2xl font-semibold text-foreground sm:text-3xl">
                You're unsubscribed
            </h1>
            <p role="status" data-test="unsubscribe-confirmation" class="mt-4 text-sm text-muted-foreground">
                You won't receive any more opening alerts from us.
            </p>
            <RouterLink to="/" class="mt-6 inline-block text-sm font-semibold text-primary hover:underline">Back to the menu</RouterLink>
        </div>
    </section>
</template>
