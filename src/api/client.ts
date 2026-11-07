import axios from 'axios'
import { getCartCredentials } from './cartCredentials'
import { useCartNoticeStore } from '@/stores/cartNotice'
import type { ApiEnvelope } from './types'

// The storefront identifies its tenant with a per-tenant API key (HTTP Basic). Anything in
// VITE_* is bundled into the client, so this is not a secret; cart access is protected by the
// per-cart token sent in X-Cart-Token.
function authHeader() {
    const user = import.meta.env.VITE_API_USER || 'store'
    const key = import.meta.env.VITE_API_KEY
    return key ? { Authorization: `Basic ${btoa(`${user}:${key}`)}` } : {}
}

export const http = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL,
    headers: { 'Content-Type': 'application/json', ...authHeader() },
})

http.interceptors.request.use((config) => {
    const { token } = getCartCredentials()

    if(token) {
        config.headers['X-Cart-Token'] = token
    }

    return config
})

http.interceptors.response.use((response) => {
    // The server empties a cart left over from an ended service and says so once
    if(response?.data?.data?.cart_reset === 'service_ended') {
        useCartNoticeStore().showReset()
    }

    return response
})

// Every endpoint wraps its payload as { data }; these unwrap the HTTP layer only
export const get = async <T>(url: string, params?: Record<string, unknown>) =>
    (await http.get<ApiEnvelope<T>>(url, { params })).data

export const post = async <T>(url: string, body?: unknown) =>
    (await http.post<ApiEnvelope<T>>(url, body ?? null)).data

export const put = async <T>(url: string, body?: unknown) =>
    (await http.put<ApiEnvelope<T>>(url, body)).data

export const del = async <T>(url: string, params?: Record<string, unknown>) =>
    (await http.delete<ApiEnvelope<T>>(url, { params })).data
