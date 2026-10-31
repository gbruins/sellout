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
    <div class="w-full shrink-0 text-center sm:w-auto" aria-labelledby="pizza-count-title">
        <p class="sr-only" role="status" aria-live="polite">
            {{ displayedCount }} {{ displayedCount === 1 ? 'pizza' : 'pizzas' }} remaining
        </p>

        <FlipNumber
            :value="String(displayedCount)"
            class="flex justify-center gap-1.5"
            aria-hidden="true"
        />

        <p id="pizza-count-title" class="mt-3 text-sm">
            <span class="font-semibold text-gold">Pizzas remaining</span>
        </p>
        <p class="mt-1 flex items-center justify-center gap-0.5 text-[12px] font-medium text-green-400">
            Order now to reserve your pie
        </p>
    </div>
</template>
