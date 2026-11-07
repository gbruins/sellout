const CART_ID_KEY = 'cart_id'
const CART_TOKEN_KEY = 'cart_token'

// The cart token is a bearer credential for one anonymous cart, issued by the server when the
// cart is created. It only lives in this browser. Storage can throw (private mode, blocked site
// data), in which case the visitor simply has no remembered cart.
const read = (key: string) => {
    try {
        return localStorage.getItem(key)
    }
    catch {
        return null
    }
}

export function getCartCredentials() {
    return { id: read(CART_ID_KEY), token: read(CART_TOKEN_KEY) }
}

export function saveCartCredentials(id: string, token: string) {
    try {
        localStorage.setItem(CART_ID_KEY, id)
        localStorage.setItem(CART_TOKEN_KEY, token)
    }
    catch { /* the cart still works for this page view */ }
}

export function clearCartCredentials() {
    try {
        localStorage.removeItem(CART_ID_KEY)
        localStorage.removeItem(CART_TOKEN_KEY)
    }
    catch { /* nothing stored */ }
}
