<script setup lang="ts">
import { ref } from 'vue'
import { useSubscribeStore } from '@/stores/subscribe'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

const subscribeStore = useSubscribeStore()

const email = ref('')
const invalid = ref(false)

// A basic shape check only — the server is the real authority on what's a valid email;
// this just avoids a round trip for an obviously empty or malformed input.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function onSubmit() {
    invalid.value = !EMAIL_PATTERN.test(email.value.trim())
    if(invalid.value) {
        return
    }

    await subscribeStore.subscribe(email.value.trim())

    if(!subscribeStore.error) {
        email.value = ''
    }
}
</script>

<template>
    <p v-if="subscribeStore.subscribed" role="status" data-test="subscribe-success" class="text-sm text-foreground">
        {{ $t('subscribe.success') }}
    </p>

    <div v-else>
        <p class="mb-3 text-sm text-muted-foreground">{{ $t('subscribe.prompt') }}</p>

        <form class="mx-auto flex max-w-sm flex-col gap-2 sm:flex-row" novalidate @submit.prevent="onSubmit">
            <Label for="subscribe-email" class="sr-only">{{ $t('subscribe.emailLabel') }}</Label>
            <input
                id="subscribe-email"
                v-model="email"
                type="email"
                name="email"
                autocomplete="email"
                inputmode="email"
                :placeholder="$t('subscribe.placeholder')"
                data-test="subscribe-email"
                :disabled="subscribeStore.loading"
                :aria-invalid="invalid || undefined"
                :aria-describedby="invalid || subscribeStore.error ? 'subscribe-error' : undefined"
                class="h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground placeholder:text-muted-foreground disabled:opacity-60 aria-invalid:border-destructive sm:text-sm"
            >
            <Button
                type="submit"
                data-test="subscribe-submit"
                :disabled="subscribeStore.loading"
                class="h-11 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
            >
                {{ subscribeStore.loading ? $t('subscribe.submitting') : $t('subscribe.submit') }}
            </Button>
        </form>

        <p v-if="invalid" id="subscribe-error" role="alert" data-test="subscribe-validation-error" class="mt-2 text-sm text-destructive">
            {{ $t('subscribe.invalid') }}
        </p>
        <p v-else-if="subscribeStore.error" id="subscribe-error" role="alert" data-test="subscribe-api-error" class="mt-2 text-sm text-destructive">
            {{ $t('subscribe.failed') }}
        </p>
    </div>
</template>
