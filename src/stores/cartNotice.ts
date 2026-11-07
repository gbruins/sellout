import { ref } from 'vue'
import { defineStore } from 'pinia'

// One-time notice that the server emptied a cart left over from an ended service
export const useCartNoticeStore = defineStore('cartNotice', () => {
    const visible = ref(false)

    function showReset() {
        visible.value = true
    }

    function dismiss() {
        visible.value = false
    }

    return { visible, showReset, dismiss }
})
