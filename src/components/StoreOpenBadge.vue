<script setup lang="ts">
import { computed } from 'vue'
import { useServiceStore } from '@/stores/service'

const service = useServiceStore()
const isOpen = computed(() => service.status === 'open')
</script>

<template>
    <span
        class="inline-flex h-7 shrink-0 items-center gap-2 border px-3 text-[10px] font-semibold uppercase sm:text-xs"
        :class="isOpen ? 'border-orange-700/70 text-orange-500' : 'border-zinc-700 text-zinc-500'"
    >
        <span class="size-2 rounded-full" :class="isOpen ? 'bg-orange-500' : 'bg-zinc-600'" aria-hidden="true"></span>
        {{ isOpen ? 'Open Now' : 'Closed' }}
    </span>
</template>
