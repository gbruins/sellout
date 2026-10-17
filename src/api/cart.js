import { getCartCredentials, saveCartCredentials, clearCartCredentials } from '@/utils/cartCredentials';

export default (utils) => {
    return {
        // Creates a cart and remembers its id and access token
        create: async (data, config) => {
            const response = await utils.$post('cart', data || {}, config);
            const cart = response?.data;

            if(cart?.id && cart?.cart_token) {
                saveCartCredentials(cart.id, cart.cart_token);
            }

            return response;
        },

        // A 404 means the cart no longer exists, so the stored credentials are useless
        get: async (config) => {
            try {
                return await utils.$get('cart', { id: getCartCredentials().id }, config);
            }
            catch(err) {
                if(err?.response?.status === 404) {
                    clearCartCredentials();
                }

                throw err;
            }
        },

        addItem: (data, config) => {
            return utils.$post('cart/item', { cart_id: getCartCredentials().id, ...data }, config);
        },

        updateItem: (data, config) => {
            return utils.$put('cart/item', data, config);
        },

        removeItem: (id, config) => {
            return utils.$delete('cart/item', { id }, config);
        },

        // Resolves with { data: { url } }; send the browser to that Stripe-hosted page
        checkout: () => {
            return utils.$post('cart/checkout', { id: getCartCredentials().id });
        },

        setCustomerNote: (customer_note, config) => {
            return utils.$put('cart/customer_note', { id: getCartCredentials().id, customer_note }, config);
        },

        // Resolves with { data: { status: 'cancelled' | 'none' | 'complete' } }
        cancelCheckout: () => {
            return utils.$post('cart/checkout/cancel', { id: getCartCredentials().id });
        },

        credentials: getCartCredentials,

        forget: clearCartCredentials,
    }
}
