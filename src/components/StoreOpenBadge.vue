<script setup lang="ts">
import { computed } from 'vue'
import { useServiceStore } from '@/stores/service'
import { Badge } from '@/components/ui/badge'
import LiveDot from './LiveDot.vue'

const service = useServiceStore()

// Before the first response the status is unknown — never show "Closed" for that
const state = computed(() => {
    if(service.status === null) return 'checking'
    if(service.status === 'open') return 'open'
    if(service.status === 'sold_out') return 'soldOut'
    return 'closed'
})
</script>

<template>
    <Badge
        data-test="store-badge"
        :class="state === 'open' ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'"
        class="h-7 gap-1.5 rounded-full px-3 py-0 text-[11px] font-semibold uppercase tracking-wide"
    >
        <LiveDot v-if="state === 'open'" />
        <span v-else class="size-1.5 rounded-full bg-muted-foreground/60" :class="{ 'animate-pulse': state === 'checking' }" aria-hidden="true" />
        {{ $t(`status.${state}`) }}
    </Badge>
</template>
