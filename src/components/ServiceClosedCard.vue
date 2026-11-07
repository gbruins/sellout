<script setup lang="ts">
import { computed } from 'vue'
import type { ServiceWindow } from '@/api'
import { useServiceStore } from '@/stores/service'
import { formatShopRange } from '@/utils/shopTime'
import { Card, CardContent } from '@/components/ui/card'
import SubscribeForm from './SubscribeForm.vue'

// Shown instead of the open hero: before a service starts, between services, or once the
// current service has sold out (then `service` is the next one, if scheduled)
const props = defineProps<{ service: ServiceWindow | null, soldOut?: boolean }>()

const serviceStore = useServiceStore()

const range = computed(() => props.service ? formatShopRange(props.service.start_at, props.service.end_at, serviceStore.timezone) : '')
</script>

<template>
    <section class="mx-auto w-full max-w-2xl px-4 py-10 sm:py-14" aria-labelledby="service-closed-title">
        <Card class="border-border">
            <CardContent class="px-6 py-8 text-center sm:px-10">
                <p class="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                    {{ soldOut ? $t('closed.soldOut') : $t('closed.closed') }}
                </p>

                <template v-if="service">
                    <h1 id="service-closed-title" class="font-heading text-2xl font-semibold text-foreground sm:text-3xl">
                        {{ $t('closed.nextService') }}
                    </h1>
                    <p data-test="service-range" class="mt-3 text-lg text-foreground">{{ range }}</p>
                    <p v-if="service.notes" data-test="service-notes" class="mt-2 text-sm text-muted-foreground">{{ service.notes }}</p>
                </template>

                <template v-else>
                    <h1 id="service-closed-title" class="font-heading text-2xl font-semibold text-foreground sm:text-3xl">
                        {{ $t('closed.noService') }}
                    </h1>
                    <p class="mt-3 text-sm text-muted-foreground">{{ $t('closed.checkBack') }}</p>
                </template>

                <div class="mt-8 border-t border-border pt-6">
                    <SubscribeForm />
                </div>
            </CardContent>
        </Card>
    </section>
</template>
