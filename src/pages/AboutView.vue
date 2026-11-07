<script setup lang="ts">
import { useServiceStore } from '@/stores/service'
import PickupInfo from '@/components/PickupInfo.vue'

const service = useServiceStore()
</script>

<template>
    <section class="mx-auto w-full max-w-2xl px-4 py-16 sm:py-24">
        <h1 class="text-center font-heading text-3xl font-semibold text-foreground sm:text-4xl">{{ $t('about.title') }}</h1>
        <p class="mt-6 text-center text-lg leading-relaxed text-muted-foreground">{{ $t('about.body') }}</p>

        <div v-if="service.shop?.address_line1" class="mx-auto mt-10 max-w-sm rounded-lg border border-border bg-card p-5">
            <h2 class="mb-3 font-heading text-lg font-semibold text-foreground">{{ $t('about.findUs') }}</h2>
            <PickupInfo />
        </div>
    </section>
</template>
