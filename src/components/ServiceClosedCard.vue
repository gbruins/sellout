<script setup lang="ts">
import { computed, ref } from 'vue'
import { type ServiceWindow, useServiceStore } from '@/stores/service'
import { useSubscribeStore } from '@/stores/subscribe'
import { formatShopRange } from '@/utils/shopTime'

const props = defineProps<{ service: ServiceWindow | null, soldOut?: boolean }>()

const serviceStore = useServiceStore()
const subscribeStore = useSubscribeStore()

const range = computed(() => props.service ? formatShopRange(props.service.start_at, props.service.end_at, serviceStore.timezone) : '')

const email = ref('')
const validationError = ref('')

// A basic shape check only — the server is the real authority on what's a valid email
// (spec FR-002); this just avoids a round trip for an obviously-empty or malformed input.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function onSubmit() {
    validationError.value = ''

    if (!EMAIL_PATTERN.test(email.value.trim())) {
        validationError.value = 'Enter a valid email address.'
        return
    }

    await subscribeStore.subscribe(email.value.trim())

    if (!subscribeStore.error) {
        email.value = ''
    }
}
</script>

<template>
    <section class="mx-auto w-full max-w-2xl px-4 py-12 text-center sm:py-16" aria-labelledby="service-closed-title">
        <div class="border border-zinc-800 bg-zinc-900/40 px-4 py-10 sm:px-8">
            <p class="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.3em] text-orange-500">
                {{ soldOut ? "We're sold out for tonight" : "We're closed right now" }}
            </p>

            <template v-if="service">
                <h1 id="service-closed-title" class="text-2xl font-bold uppercase text-zinc-100 sm:text-3xl">
                    Next service
                </h1>
                <p data-test="service-range" class="mt-4 text-lg text-zinc-200">{{ range }}</p>
                <p v-if="service.notes" data-test="service-notes" class="mt-3 text-sm text-zinc-400">{{ service.notes }}</p>
            </template>

            <template v-else>
                <h1 id="service-closed-title" class="text-2xl font-bold uppercase text-zinc-100 sm:text-3xl">
                    No service scheduled
                </h1>
                <p class="mt-4 text-sm text-zinc-400">Check back soon for the next open window.</p>
            </template>

            <div class="mt-8 border-t border-zinc-800 pt-6">
                <template v-if="subscribeStore.subscribed">
                    <p role="status" data-test="subscribe-success" class="text-sm text-zinc-200">
                        You're subscribed! We'll email you when we're next open.
                    </p>
                </template>

                <template v-else>
                    <p class="mb-3 text-sm text-zinc-400">Get an email when we're next open.</p>

                    <form class="mx-auto flex max-w-sm flex-col gap-2 sm:flex-row" @submit.prevent="onSubmit">
                        <input
                            v-model="email"
                            type="email"
                            placeholder="you@example.com"
                            data-test="subscribe-email"
                            :disabled="subscribeStore.loading"
                            class="w-full border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 disabled:opacity-60" />
                        <button
                            type="submit"
                            data-test="subscribe-submit"
                            :disabled="subscribeStore.loading"
                            class="shrink-0 bg-orange-600 px-4 py-3 text-sm font-bold uppercase text-zinc-950 disabled:opacity-50">
                            Notify me
                        </button>
                    </form>

                    <p v-if="validationError" role="alert" data-test="subscribe-validation-error" class="mt-2 text-sm text-red-300">
                        {{ validationError }}
                    </p>
                    <p v-else-if="subscribeStore.error" role="alert" data-test="subscribe-api-error" class="mt-2 text-sm text-red-300">
                        Something went wrong. Please try again.
                    </p>
                </template>
            </div>
        </div>
    </section>
</template>
