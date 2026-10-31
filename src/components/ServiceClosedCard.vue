<script setup lang="ts">
import { computed, ref } from 'vue'
import { type ServiceWindow, useServiceStore } from '@/stores/service'
import { useSubscribeStore } from '@/stores/subscribe'
import { formatShopRange } from '@/utils/shopTime'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

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
    <section class="mx-auto w-full max-w-2xl px-4 py-10 sm:py-14" aria-labelledby="service-closed-title">
        <Card class="border-border">
            <CardContent class="px-6 py-8 text-center sm:px-10">
                <p class="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                    {{ soldOut ? "We're sold out for tonight" : "We're closed right now" }}
                </p>

                <template v-if="service">
                    <h1 id="service-closed-title" class="font-heading text-2xl font-semibold text-foreground sm:text-3xl">
                        Next service
                    </h1>
                    <p data-test="service-range" class="mt-3 text-lg text-foreground">{{ range }}</p>
                    <p v-if="service.notes" data-test="service-notes" class="mt-2 text-sm text-muted-foreground">{{ service.notes }}</p>
                </template>

                <template v-else>
                    <h1 id="service-closed-title" class="font-heading text-2xl font-semibold text-foreground sm:text-3xl">
                        No service scheduled
                    </h1>
                    <p class="mt-3 text-sm text-muted-foreground">Check back soon for the next open window.</p>
                </template>

                <div class="mt-8 border-t border-border pt-6">
                    <template v-if="subscribeStore.subscribed">
                        <p role="status" data-test="subscribe-success" class="text-sm text-foreground">
                            You're subscribed! We'll email you when we're next open.
                        </p>
                    </template>

                    <template v-else>
                        <p class="mb-3 text-sm text-muted-foreground">Get an email when we're next open.</p>

                        <form class="mx-auto flex max-w-sm flex-col gap-2 sm:flex-row" @submit.prevent="onSubmit">
                            <input
                                v-model="email"
                                type="email"
                                placeholder="you@example.com"
                                data-test="subscribe-email"
                                :disabled="subscribeStore.loading"
                                class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground disabled:opacity-60" />
                            <Button
                                type="submit"
                                data-test="subscribe-submit"
                                :disabled="subscribeStore.loading"
                                class="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90">
                                Notify me
                            </Button>
                        </form>

                        <p v-if="validationError" role="alert" data-test="subscribe-validation-error" class="mt-2 text-sm text-destructive">
                            {{ validationError }}
                        </p>
                        <p v-else-if="subscribeStore.error" role="alert" data-test="subscribe-api-error" class="mt-2 text-sm text-destructive">
                            Something went wrong. Please try again.
                        </p>
                    </template>
                </div>
            </CardContent>
        </Card>
    </section>
</template>
