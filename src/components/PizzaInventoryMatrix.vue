<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
    total: number
    remaining: number
}>()

const totalCount = computed(() => Number.isFinite(props.total) ? Math.max(0, Math.floor(props.total)) : 0)
const remainingCount = computed(() => Number.isFinite(props.remaining)
    ? Math.min(totalCount.value, Math.max(0, Math.floor(props.remaining)))
    : 0)
const allocatedCount = computed(() => totalCount.value - remainingCount.value)
const slots = computed(() => Array.from({ length: totalCount.value }, (_, index) => index))
</script>

<template>
    <section class="bg-zinc-950 px-4 pb-10 text-zinc-100 sm:pb-14" aria-labelledby="inventory-matrix-title">
        <div class="mx-auto w-full max-w-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-8">
            <div class="mb-3 flex items-center justify-between gap-3 font-mono text-[9px] font-bold uppercase tracking-wider sm:text-xs">
                <h2 id="inventory-matrix-title" class="flex items-center gap-2 text-zinc-300">
                    <span class="size-2 shrink-0 bg-orange-600" aria-hidden="true"></span>
                    <span>Active matrix: {{ allocatedCount }} allocated</span>
                </h2>
                <p class="shrink-0 text-amber-400">[ {{ remainingCount }} remaining ]</p>
            </div>

            <div
                class="grid grid-cols-6 gap-1.5 border border-zinc-800 bg-zinc-950 p-2 sm:grid-cols-10 sm:gap-2 sm:p-3 lg:grid-cols-12"
                role="img"
                :aria-label="`${allocatedCount} allocated and ${remainingCount} remaining out of ${totalCount} pizzas`"
            >
                <span
                    v-for="slot in slots"
                    :key="slot"
                    class="h-3 border sm:h-3.5"
                    :class="slot < allocatedCount
                        ? 'allocated-slot border-zinc-800 bg-zinc-900'
                        : 'remaining-slot border-orange-400 bg-orange-600 shadow-[0_0_8px_rgba(234,88,12,0.45)]'"
                    aria-hidden="true"
                ></span>
            </div>

            <div class="mt-3 flex items-center justify-between font-mono text-[8px] uppercase tracking-wider text-zinc-600 sm:text-[9px]">
                <span>Slot 01</span>
                <span class="text-center">// Analog physical flip-slots //</span>
                <span>Hard cap {{ totalCount }}</span>
            </div>
        </div>
    </section>
</template>
