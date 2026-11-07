<script setup lang="ts">
import { computed } from 'vue'
import { useServiceStore } from '@/stores/service'
import { formatShopTime } from '@/utils/shopTime'
import LiveDot from './LiveDot.vue'
import PickupInfo from './PickupInfo.vue'
import PizzaRemainingCountdown from './PizzaRemainingCountdown.vue'

// The home page hero while the shop is open and has pizzas left
const service = useServiceStore()

const closesAt = computed(() => service.service ? formatShopTime(service.service.end_at, service.timezone) : null)
</script>

<template>
    <section class="px-4 pt-8 pb-4 sm:px-6 sm:pt-10 sm:pb-5" aria-labelledby="hero-title">
        <div class="mx-auto flex w-full max-w-5xl flex-col gap-6 rounded-xl bg-charcoal px-5 py-6 text-charcoal-foreground sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:px-7 sm:py-6">
            <div class="flex items-start gap-4">
                <div class="mt-1 flex size-10 shrink-0 items-center justify-center rounded-md border border-green-400/30 bg-green-400/10" aria-hidden="true">
                    <LiveDot size="lg" />
                </div>

                <div class="min-w-0">
                    <p class="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-green-400">{{ $t('hero.eyebrow') }}</p>
                    <h1 id="hero-title" class="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
                        {{ $t('hero.title') }}
                    </h1>
                    <p v-if="closesAt" data-test="open-until" class="mt-2 text-sm text-charcoal-foreground/70">{{ $t('hero.openUntil', { time: closesAt }) }}</p>
                    <PickupInfo tone="inverted" compact class="mt-4" />
                </div>
            </div>

            <PizzaRemainingCountdown :remaining="service.remaining" />
        </div>
    </section>
</template>
