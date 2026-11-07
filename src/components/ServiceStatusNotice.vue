<script setup lang="ts">
import { Button } from '@/components/ui/button'

defineProps<{ loading?: boolean, error?: boolean }>()
defineEmits<{ retry: [] }>()
</script>

<template>
    <section class="mx-auto w-full max-w-2xl px-4 py-12 text-center" role="status" aria-live="polite">
        <p v-if="error" class="text-sm text-muted-foreground">
            {{ $t('service.stale') }}
            <Button type="button" data-test="retry" variant="outline" size="sm" class="ml-2" @click="$emit('retry')">
                {{ $t('common.retry') }}
            </Button>
        </p>
        <p v-else-if="loading" class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{{ $t('common.loading') }}</p>
    </section>
</template>
