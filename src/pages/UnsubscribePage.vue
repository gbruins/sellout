<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { api } from '@/api'

const route = useRoute()
const token = typeof route.query.token === 'string' && route.query.token ? route.query.token : null

const state = ref<'working' | 'done' | 'failed' | 'invalid'>(token ? 'working' : 'invalid')

onMounted(async () => {
    if(!token) {
        return
    }

    try {
        await api.subscribe.unsubscribe(token)
        state.value = 'done'
    }
    catch {
        state.value = 'failed'
    }
})

const copy = computed(() => ({
    working: { title: 'unsubscribe.working', body: null },
    done: { title: 'unsubscribe.doneTitle', body: 'unsubscribe.doneBody' },
    failed: { title: 'unsubscribe.failedTitle', body: 'unsubscribe.failedBody' },
    invalid: { title: 'unsubscribe.invalidTitle', body: 'unsubscribe.invalidBody' },
}[state.value]))
</script>

<template>
    <section class="mx-auto w-full max-w-2xl px-4 py-12 text-center sm:py-16">
        <div class="rounded-lg border border-border bg-card px-4 py-10 sm:px-8" role="status" aria-live="polite">
            <h1 data-test="unsubscribe-title" class="font-heading text-2xl font-semibold text-foreground sm:text-3xl">
                {{ $t(copy.title) }}
            </h1>
            <p v-if="copy.body" data-test="unsubscribe-body" class="mt-4 text-sm text-muted-foreground">
                {{ $t(copy.body) }}
            </p>
            <RouterLink v-if="state !== 'working'" to="/" class="mt-6 inline-block text-sm font-semibold text-primary hover:underline">{{ $t('nav.backToMenu') }}</RouterLink>
        </div>
    </section>
</template>
