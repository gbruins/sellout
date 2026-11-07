import { del, get, post, put } from './client'
import { clearCartCredentials, getCartCredentials, saveCartCredentials } from './cartCredentials'
import type { CancelCheckoutResult, Cart, CreatedCart, OrderConfirmation, RealtimeToken, ServiceState } from './types'

const cartId = () => getCartCredentials().id

// A plain module rather than an injected plugin: stores and composables can import it from
// anywhere (not only inside a component's setup), and tests replace methods with vi.spyOn.
export const api = {
    cart: {
        // Creates a cart and remembers its id and access token
        async create() {
            const response = await post<CreatedCart>('cart', {})

            if(response.data?.id && response.data?.cart_token) {
                saveCartCredentials(response.data.id, response.data.cart_token)
            }

            return response
        },

        // A 404 means the cart no longer exists, so the stored credentials are useless
        async get() {
            try {
                return await get<Cart>('cart', { id: cartId() })
            }
            catch(err) {
                if((err as { response?: { status?: number } })?.response?.status === 404) {
                    clearCartCredentials()
                }

                throw err
            }
        },

        addItem: (data: { product_id: string, qty: number }) => post<unknown>('cart/item', { cart_id: cartId(), ...data }),

        updateItem: (data: { id: string, qty: number }) => put<unknown>('cart/item', data),

        removeItem: (id: string) => del<unknown>('cart/item', { id }),

        // The client_secret mounts Stripe's Embedded Checkout inline on /cart
        checkout: () => post<{ client_secret: string }>('cart/checkout', { id: cartId() }),

        setCustomerNote: (customerNote: string | null) => put<Cart>('cart/customer_note', { id: cartId(), customer_note: customerNote }),

        cancelCheckout: () => post<CancelCheckoutResult>('cart/checkout/cancel', { id: cartId() }),

        credentials: getCartCredentials,

        forget: clearCartCredentials,
    },

    orders: {
        // By the Stripe Checkout Session id in the return URL — needs no cart credentials
        confirmation: async (sessionId: string) => (await get<OrderConfirmation>('orders/confirmation', { session_id: sessionId })).data,
    },

    service: {
        // Current or next service state: status, remaining pizzas, menu, pickup location
        getNext: async () => (await get<ServiceState>('services/next')).data,

        // Short-lived Supabase Realtime token for the live-updates subscription
        getRealtimeToken: async () => (await post<RealtimeToken>('services/next/realtime-token')).data,
    },

    subscribe: {
        subscribe: async (email: string) => (await post<unknown>('subscribers', { email })).data,

        unsubscribe: async (token: string) => (await get<unknown>('subscribers/unsubscribe', { token })).data,
    },
}

export type Api = typeof api
export * from './types'
