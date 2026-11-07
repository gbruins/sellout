<script setup lang="ts">
// The pulsing "we're live" dot. The ping stops for visitors who prefer reduced motion.
withDefaults(defineProps<{ size?: 'sm' | 'lg' }>(), { size: 'sm' })
</script>

<template>
    <span class="relative flex" :class="size === 'lg' ? 'size-3.5' : 'size-1.5'" aria-hidden="true">
        <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75 motion-reduce:hidden" />
        <span
            class="relative rounded-full"
            :class="size === 'lg' ? 'size-3.5 bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.8)]' : 'size-1.5 bg-green-500'"
        />
    </span>
</template>
