<script setup lang="ts">
import { computed } from 'vue'

// A message banner inside page content. `error` is announced immediately; the others politely.
const props = withDefaults(defineProps<{ variant?: 'error' | 'info' | 'notice' }>(), { variant: 'info' })

const classes = computed(() => ({
    error: 'border-destructive/30 bg-destructive/5 text-destructive',
    info: 'border-border bg-secondary text-secondary-foreground',
    notice: 'border-primary/40 bg-primary/5 text-foreground',
}[props.variant]))
</script>

<template>
    <div
        :role="variant === 'error' ? 'alert' : 'status'"
        class="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border px-3 py-2 text-sm"
        :class="classes"
    >
        <span class="min-w-0 flex-1">
            <slot />
        </span>
        <slot name="action" />
    </div>
</template>
