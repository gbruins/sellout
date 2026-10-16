<script setup lang="ts">
import { useCartNoticeStore } from '@/stores/cartNotice'

const notice = useCartNoticeStore()
</script>

<template>
    <div v-if="notice.message" role="status" class="border-b border-orange-700/50 bg-zinc-900 px-4 py-3 text-center text-sm text-zinc-200">
        {{ notice.message }}
        <button type="button" data-test="dismiss" class="ml-3 text-xs font-semibold uppercase text-orange-500" @click="notice.dismiss()">
            Dismiss
        </button>
    </div>
</template>
