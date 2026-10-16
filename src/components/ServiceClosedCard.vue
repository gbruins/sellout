<script setup lang="ts">
import { computed } from 'vue'
import type { ServiceWindow } from '@/stores/service'
import { formatShopRange } from '@/utils/shopTime'

const props = defineProps<{ service: ServiceWindow | null }>()

const range = computed(() => props.service ? formatShopRange(props.service.start_at, props.service.end_at) : '')
</script>

<template>
    <section class="mx-auto w-full max-w-2xl px-4 py-12 text-center sm:py-16" aria-labelledby="service-closed-title">
        <div class="border border-zinc-800 bg-zinc-900/40 px-4 py-10 sm:px-8">
            <p class="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.3em] text-orange-500">
                We're closed right now
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
        </div>
    </section>
</template>
