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
        <div class="border border-zinc-800 bg-zinc-900/40 px-4 py-10 sm:px-8">
            <h1 class="text-2xl font-bold uppercase text-zinc-100 sm:text-3xl">
                You're unsubscribed
            </h1>
            <p role="status" data-test="unsubscribe-confirmation" class="mt-4 text-sm text-zinc-400">
                You won't receive any more opening alerts from us.
            </p>
            <RouterLink to="/" class="mt-6 inline-block text-sm text-orange-500">Back to the menu</RouterLink>
        </div>
    </section>
</template>
