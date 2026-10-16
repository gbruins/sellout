const MESSAGES: Record<string, string> = {
    no_open_service: 'The shop is not open right now.',
    service_closed: 'The shop is not open right now.',
    sold_out: 'Sorry, we are sold out.',
}

interface ApiErrorLike {
    response?: { status?: number, data?: { message?: string, data?: { code?: string, max_per_order?: number, remaining?: number } } }
}

/**
 * Turns a failed cart or checkout call into a message for the customer.
 * The server sends a `code` with 409 responses about service hours, stock and the order cap.
 */
export function cartErrorMessage(error: unknown): string {
    const response = (error as ApiErrorLike)?.response
    const detail = response?.data?.data

    if(response?.status === 409 && detail?.code) {
        if(detail.code === 'over_limit') {
            const limit = Math.min(detail.max_per_order ?? Infinity, detail.remaining ?? Infinity)
            return Number.isFinite(limit)
                ? `You can order up to ${limit} ${limit === 1 ? 'pizza' : 'pizzas'}.`
                : 'That is more pizzas than you can order.'
        }

        if(MESSAGES[detail.code]) {
            return MESSAGES[detail.code]!
        }
    }

    return response?.data?.message || 'Something went wrong. Please try again.'
}
