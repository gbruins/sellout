<script setup lang="ts">
import { computed } from 'vue'
import FlipNumber from './flipNumber/FlipNumber.vue'

const props = withDefaults(defineProps<{ remaining?: number, total?: number }>(), {
    remaining: 14,
    total: 60,
})

const displayedCount = computed(() => Math.max(0, Math.floor(props.remaining)))
</script>

<template>
    <div class="flex w-full shrink-0 items-center justify-center gap-4 sm:w-auto sm:justify-start" aria-labelledby="pizza-count-title">
        <p class="sr-only" role="status" aria-live="polite">
            {{ displayedCount }} {{ displayedCount === 1 ? 'pizza' : 'pizzas' }} remaining
        </p>

        <FlipNumber
            :value="String(displayedCount)"
            class="flex gap-1.5"
            aria-hidden="true"
        />

        <div class="text-left">
            <p id="pizza-count-title" class="text-base">
                <span class="font-semibold text-gold">Pizzas remaining</span>
            </p>
            <p class="mt-1 text-[12px] font-medium text-green-400">
                Order now to reserve yours
            </p>
        </div>
    </div>
</template>
