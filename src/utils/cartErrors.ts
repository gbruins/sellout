import { errorDetail, errorStatus } from '@/api'

// A message stored as an i18n key so components render it with $t(), not as English text
export interface Message {
    key: string
    params?: Record<string, unknown>
    plural?: number
}

const BY_CODE: Record<string, string> = {
    no_open_service: 'errors.notOpen',
    service_closed: 'errors.notOpen',
    sold_out: 'errors.soldOut',
    checkout_in_progress: 'errors.checkoutInProgress',
}

/**
 * Turns a failed cart or checkout call into a message for the customer.
 * The server sends a `code` with 409 responses about service hours, stock and the order cap.
 */
export function cartErrorMessage(error: unknown): Message {
    const detail = errorDetail(error)

    if(errorStatus(error) === 409 && detail?.code) {
        if(detail.code === 'over_limit') {
            const limit = Math.min(detail.max_per_order ?? Infinity, detail.remaining ?? Infinity)
            return Number.isFinite(limit)
                ? { key: 'errors.overLimit', params: { n: limit }, plural: limit }
                : { key: 'errors.overLimitUnknown' }
        }

        if(detail.code === 'item_unavailable') {
            return detail.title
                ? { key: 'errors.itemUnavailable', params: { title: detail.title } }
                : { key: 'errors.anItemUnavailable' }
        }

        const key = BY_CODE[detail.code]
        if(key) {
            return { key }
        }
    }

    return { key: 'errors.generic' }
}
