<script setup lang="ts">
import { computed } from 'vue'
import { useServiceStore } from '@/stores/service'
import { Badge } from '@/components/ui/badge'

const service = useServiceStore()
const isOpen = computed(() => service.status === 'open')
</script>

<template>
    <Badge
        :class="isOpen ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'"
        class="h-7 gap-1.5 rounded-full px-3 py-0 text-[11px] font-semibold uppercase tracking-wide"
    >
        <span v-if="isOpen" class="relative flex size-1.5" aria-hidden="true">
            <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75"></span>
            <span class="relative size-1.5 rounded-full bg-green-500"></span>
        </span>
        <span v-else class="size-1.5 rounded-full bg-muted-foreground/60" aria-hidden="true"></span>
        {{ isOpen ? 'Open now' : 'Closed' }}
    </Badge>
</template>
