import { useI18n } from 'vue-i18n'

// Prices come from the API in cents and are shown without a currency symbol everywhere
export function usePrice() {
    const { n } = useI18n()

    const formatPrice = (cents: number | null | undefined) =>
        typeof cents === 'number' && Number.isFinite(cents) ? n(cents / 100, 'price') : ''

    return { formatPrice }
}
