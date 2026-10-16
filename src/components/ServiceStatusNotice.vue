<script setup lang="ts">
defineProps<{ loading?: boolean, error?: boolean }>()
defineEmits<{ retry: [] }>()
</script>

<template>
    <section class="mx-auto w-full max-w-2xl px-4 py-12 text-center" role="status" aria-live="polite">
        <p v-if="error" class="text-sm text-zinc-300">
            We couldn't load the latest service info. What you see may be out of date.
            <button type="button" data-test="retry" class="ml-2 border border-orange-700/70 px-3 py-1 text-xs font-semibold uppercase text-orange-500" @click="$emit('retry')">
                Retry
            </button>
        </p>
        <p v-else-if="loading" class="font-mono text-xs uppercase tracking-widest text-zinc-500">Loading…</p>
    </section>
</template>
