const CART_ID_KEY = 'cart_id';
const CART_TOKEN_KEY = 'cart_token';

// The cart token is a bearer credential for one anonymous cart, issued by the
// server when the cart is created. It only lives in this browser.
export function getCartCredentials() {
    return {
        id: localStorage.getItem(CART_ID_KEY),
        token: localStorage.getItem(CART_TOKEN_KEY),
    };
}

export function saveCartCredentials(id, token) {
    localStorage.setItem(CART_ID_KEY, id);
    localStorage.setItem(CART_TOKEN_KEY, token);
}

export function clearCartCredentials() {
    localStorage.removeItem(CART_ID_KEY);
    localStorage.removeItem(CART_TOKEN_KEY);
}
