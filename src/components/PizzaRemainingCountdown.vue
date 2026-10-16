<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{ remaining?: number }>(), {
    remaining: 14,
})

const displayedCount = computed(() => Math.max(0, Math.floor(props.remaining)))
const digits = computed(() => String(displayedCount.value).split(''))
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
                <div class="flex justify-center gap-3 sm:gap-5" aria-hidden="true">
                    <div class="flex gap-3 sm:gap-5">
                        <span
                            v-for="(digit, index) in digits"
                            :key="index"
                            class="flap-digit relative grid h-32 w-[5.5rem] place-items-center overflow-hidden rounded-md border border-zinc-700 bg-gradient-to-b from-zinc-800 to-zinc-900 font-mono text-8xl font-bold leading-none text-white shadow-[0_12px_24px_rgba(0,0,0,0.5)] sm:h-52 sm:w-44 sm:text-[9rem]"
                        >
                            <Transition name="flap" mode="out-in">
                                <span :key="digit" class="flap-number">{{ digit }}</span>
                            </Transition>
                        </span>
                    </div>
                </div>
            </div>
        </div>
    </section>
</template>

<style scoped>
.flap-digit::before {
    position: absolute;
    z-index: 1;
    top: 50%;
    right: 0;
    left: 0;
    border-top: 1px solid rgb(9 9 11 / 90%);
    content: '';
}

.flap-digit::after {
    position: absolute;
    z-index: 2;
    top: calc(50% - 0.4rem);
    right: -0.25rem;
    left: -0.25rem;
    height: 0.8rem;
    border-right: 0.25rem solid rgb(63 63 70);
    border-left: 0.25rem solid rgb(63 63 70);
    content: '';
}

.flap-number {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    backface-visibility: hidden;
}

.flap-enter-active,
.flap-leave-active {
    transition:
        transform 260ms ease-in,
        opacity 180ms ease-in;
}

.flap-enter-from {
    transform: perspective(500px) rotateX(88deg);
    transform-origin: top;
    opacity: 0.4;
}

.flap-leave-to {
    transform: perspective(500px) rotateX(-88deg);
    transform-origin: bottom;
    opacity: 0;
}

.flap-leave-active {
    position: absolute;
}

@media (prefers-reduced-motion: reduce) {
    .flap-enter-active,
    .flap-leave-active {
        transition-duration: 0.01ms;
    }
}
</style>
