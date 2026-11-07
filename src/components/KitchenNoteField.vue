<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { NOTE_MAX, useCartStore } from '@/stores/cart'

// Saves itself: shortly after typing stops and on blur. Paying saves any unsaved draft
// first, so tapping Pay straight from this field never loses the note.
const cart = useCartStore()

const saveSoon = useDebounceFn(() => cart.saveNote(), 1000)
</script>

<template>
    <div>
        <label for="customer-note" class="mb-1 block text-xs font-semibold uppercase text-muted-foreground">{{ $t('note.label') }}</label>
        <textarea
            id="customer-note"
            v-model="cart.noteDraft"
            name="customer-note"
            data-test="note"
            rows="3"
            class="w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground sm:text-sm"
            :maxlength="NOTE_MAX"
            aria-describedby="customer-note-status"
            @input="saveSoon"
            @blur="cart.saveNote()"
        />
        <div id="customer-note-status" class="mt-1 flex items-center justify-between text-xs text-muted-foreground">
            <span data-test="note-count">{{ $t('note.count', { count: cart.noteDraft.length, max: NOTE_MAX }) }}</span>
            <span v-if="cart.noteStatus === 'saving'" data-test="note-status" aria-live="polite">{{ $t('note.saving') }}</span>
            <span v-else-if="cart.noteStatus === 'saved' && !cart.noteDirty" data-test="note-status" aria-live="polite">{{ $t('note.saved') }}</span>
            <span v-else-if="cart.noteStatus === 'error'" data-test="note-status" role="alert" class="text-destructive">{{ $t('note.failed') }}</span>
        </div>
    </div>
</template>
