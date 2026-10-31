<script setup lang="ts">
import { useCartNoticeStore } from '@/stores/cartNotice'
import { Button } from '@/components/ui/button'

const notice = useCartNoticeStore()
</script>

<template>
    <div v-if="notice.message" role="status" class="border-b border-border bg-secondary px-4 py-3 text-center text-sm text-secondary-foreground">
        {{ notice.message }}
        <Button type="button" data-test="dismiss" variant="link" size="sm" class="ml-2 h-auto p-0 text-primary" @click="notice.dismiss()">
            Dismiss
        </Button>
    </div>
</template>
