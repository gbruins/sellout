// Response shapes of the strawberry-server endpoints the storefront calls. Prices are in cents.

export interface ApiEnvelope<T> {
    data: T
}

export type ServiceStatus = 'open' | 'sold_out' | 'upcoming' | 'none'

export interface ServiceWindow {
    id: string
    start_at: string
    end_at: string
    notes: string | null
    inventory_count: number
    max_per_order: number
}

export interface MenuProduct {
    id: string
    title: string
    description: string | null
    base_price: number | null
    image?: string | null
    // Counts toward the service's max_per_order and stock (true for pizzas). Missing means limited.
    limited?: boolean
    // The product type's value and name; the menu is shown in one section per type
    product_type?: number
    type_name?: string | null
    // False when out of stock for this service: shown, but can't be ordered. Missing means available.
    available?: boolean
}

export interface ServiceMenu {
    id: string
    title: string
    description: string | null
    products: MenuProduct[]
}

// The tenant's own pickup location (GET /services/next `shop`)
export interface Shop {
    name: string | null
    address_line1: string | null
    address_line2: string | null
    address_city: string | null
    address_state: string | null
    address_postal_code: string | null
    phone: string | null
}

export interface ServiceState {
    status: ServiceStatus
    server_now: string
    timezone: string | null
    shop?: Shop | null
    service: ServiceWindow | null
    remaining?: number
    menu?: ServiceMenu | null
    next_service: ServiceWindow | null
}

export interface RealtimeToken {
    realtime_jwt: string | null
    tenant_id: string
}

export interface CartLineData {
    id: string
    qty: number
    price_subtotal: number
    product: { id: string, title: string, base_price: number | null }
}

export interface Cart {
    id: string
    num_items: number
    price_subtotal: number
    grand_total: number
    customer_note: string | null
    checkout_in_progress: boolean
    closed_at?: string | null
    cart_items: CartLineData[]
    cart_reset?: 'service_ended'
}

export interface CreatedCart {
    id: string
    cart_token: string
}

export interface CancelCheckoutResult {
    status: 'cancelled' | 'none' | 'complete'
}

export type OrderConfirmation =
    | { status: 'pending' }
    | {
        status: 'complete'
        pickup_code: number | null
        billing_email: string | null
        items: { id: string, title: string | null, qty: number, price_subtotal: number }[]
        price_subtotal: number
        sales_tax: number
        grand_total: number
    }

// The error body the server sends with a 409 about service hours, stock or the order cap
export interface ApiErrorDetail {
    code?: string
    max_per_order?: number
    remaining?: number
    title?: string
    product_id?: string
}

export interface ApiError {
    response?: { status?: number, data?: { message?: string, data?: ApiErrorDetail } }
}

export const errorStatus = (err: unknown) => (err as ApiError)?.response?.status
export const errorDetail = (err: unknown) => (err as ApiError)?.response?.data?.data
