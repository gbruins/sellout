<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import FlipNumber from './flipNumber/FlipNumber.vue'

const props = withDefaults(defineProps<{ remaining?: number }>(), {
    remaining: 14,
})

const testCount = ref(props.remaining)
const displayedCount = computed(() => Math.max(
    0,
    Math.floor(import.meta.env.DEV ? testCount.value : props.remaining),
))

watch(() => props.remaining, (remaining) => {
    testCount.value = remaining
})

// let testTimer: ReturnType<typeof setTimeout> | undefined

// onMounted(() => {
//     if (!import.meta.env.DEV) return

//     const advanceTestCount = () => {
//         testCount.value = Math.max(0, testCount.value - 1)
//         console.log(testCount.value)
//         testTimer = setTimeout(advanceTestCount, 1000)
//     }

//     testTimer = setTimeout(advanceTestCount, 1000)
// })

// onBeforeUnmount(() => {
//     if (testTimer) clearTimeout(testTimer)
// })
</script>

<template>
    <section class="bg-zinc-950 px-4 py-10 text-zinc-100 sm:py-14" aria-labelledby="pizza-count-title">
        <div class="mx-auto w-full max-w-2xl">
            <div class="mb-4 flex items-center justify-between gap-4 border-b border-zinc-800 pb-3 font-mono text-[10px] uppercase tracking-widest sm:text-xs">
                <p class="text-zinc-500"><span class="font-bold text-orange-500">Batch #04</span><span class="mx-2 text-zinc-700">//</span>Hard cap 60 pies</p>
                <p class="shrink-0 font-bold text-amber-400">Claim velocity: 1 pie / 44s</p>
            </div>

            <div class="relative border border-zinc-800 bg-zinc-900/40 px-4 py-8 sm:px-8 sm:py-10">
                <span class="absolute left-3 top-3 font-mono text-[9px] text-zinc-700" aria-hidden="true">+</span>
                <span class="absolute right-3 top-3 font-mono text-[9px] text-zinc-700" aria-hidden="true">+</span>
                <h1 id="pizza-count-title" class="mb-6 text-center font-mono text-[10px] uppercase tracking-[0.35em] text-zinc-500 sm:text-xs">
                    Pizzas remaining
                </h1>

                <p class="sr-only" role="status" aria-live="polite">
                    {{ displayedCount }} {{ displayedCount === 1 ? 'pizza' : 'pizzas' }} remaining
                </p>

                <!-- countdown flippers -->
                <FlipNumber
                    :value="String(displayedCount)"
                    class="flex justify-center gap-3 sm:gap-5"
                    aria-hidden="true"
                />
            </div>
        </div>
    </section>
</template>
