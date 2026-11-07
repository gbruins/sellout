import { onBeforeUnmount, onMounted, watch } from 'vue'
import { useDocumentVisibility } from '@vueuse/core'
import { useServiceStore } from '@/stores/service'

/**
 * Keeps the service store (open/closed, pizzas remaining, menu) live for as long as the
 * caller is mounted. Called once, by the layout, so navigating between pages keeps one
 * Realtime connection instead of tearing it down and re-authenticating on every route — and
 * every page (including About) gets a real status for the header badge.
 */
export function useLiveServiceStatus() {
    const service = useServiceStore()
    const visibility = useDocumentVisibility()

    onMounted(async () => {
        await service.load()
        service.connect()
    })

    watch(visibility, (state) => {
        if(state === 'visible') {
            service.resume()
        }
    })

    onBeforeUnmount(() => service.disconnect())

    return service
}
