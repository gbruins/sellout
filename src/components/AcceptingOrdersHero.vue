<script setup lang="ts">
import PizzaRemainingCountdown from './PizzaRemainingCountdown.vue'

defineProps<{ remaining: number, total: number }>()
</script>

<template>
    <section class="px-4 pt-8 pb-4 sm:px-6 sm:pt-10 sm:pb-5" aria-labelledby="hero-title">
        <div class="mx-auto flex w-full max-w-5xl flex-col gap-6 rounded-xl bg-charcoal px-5 py-6 text-charcoal-foreground sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:px-7 sm:py-5">
            <div class="flex items-start gap-4">
                <div class="mt-1 flex size-10 shrink-0 items-center justify-center rounded-md border border-green-400/30 bg-green-400/10" aria-hidden="true">
                    <span class="relative flex size-3.5">
                        <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                        <span class="relative size-3.5 rounded-full bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.8)]"></span>
                    </span>
                </div>

                <div>
                    <p class="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-green-400">Open now</p>
                    <h1 id="hero-title" class="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
                        Accepting Orders
                    </h1>
                    <p class="mt-2 text-sm text-charcoal-foreground/70">We close when allocation runs out.</p>
                </div>
            </div>

            <PizzaRemainingCountdown :remaining="remaining" :total="total" />
        </div>
    </section>
</template>
