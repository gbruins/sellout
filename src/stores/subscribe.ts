import { inject, ref } from 'vue'
import { defineStore } from 'pinia'

export const useSubscribeStore = defineStore('subscribe', () => {
    const api = inject<Record<string, any>>('$api') // eslint-disable-line @typescript-eslint/no-explicit-any

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
