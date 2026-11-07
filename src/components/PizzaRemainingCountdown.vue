<script setup lang="ts">
import { computed } from 'vue'
import FlipNumber from './flipNumber/FlipNumber.vue'

const props = defineProps<{ remaining: number }>()

const displayedCount = computed(() => Math.max(0, Math.floor(props.remaining)))
</script>

<template>
    <div class="flex w-full shrink-0 items-center justify-center gap-4 sm:w-auto sm:justify-start">
        <p class="sr-only" role="status" aria-live="polite">
            {{ $t('hero.remainingSr', displayedCount) }}
        </p>

        <FlipNumber
            :value="String(displayedCount)"
            class="flex gap-1.5"
            aria-hidden="true"
        />

        <div class="text-left" aria-hidden="true">
            <p class="text-lg font-semibold text-gold sm:text-xl">{{ $t('hero.remaining') }}</p>
            <p class="mt-1 text-xs font-medium text-green-400 sm:text-sm">{{ $t('hero.reserve') }}</p>
        </div>
    </div>
</template>
