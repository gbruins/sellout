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

        get: (config) => {
            return utils.$get('cart', { id: getCartCredentials().id }, config);
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

        forget: clearCartCredentials,
    }
}
