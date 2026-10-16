import { ref } from 'vue'
import { defineStore } from 'pinia'

// One-time messages about the cart, shown wherever the customer is
export const useCartNoticeStore = defineStore('cartNotice', () => {
    const message = ref<string | null>(null)

    function showReset() {
        message.value = 'Your previous service has ended, so your cart was emptied.'
    }

    function dismiss() {
        message.value = null
    }

    return { message, showReset, dismiss }
})
