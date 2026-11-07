import { ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/api'

export const useSubscribeStore = defineStore('subscribe', () => {
    const loading = ref(false)
    const error = ref(false)
    const subscribed = ref(false)

    async function subscribe(email: string) {
        loading.value = true
        error.value = false

        try {
            await api.subscribe.subscribe(email)
            subscribed.value = true
        } catch {
            error.value = true
        } finally {
            loading.value = false
        }
    }

    function reset() {
        subscribed.value = false
        error.value = false
    }

    return { loading, error, subscribed, subscribe, reset }
})
