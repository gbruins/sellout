export default (utils) => {
    return {
        subscribe: async (email, config) => {
            const response = await utils.$post('subscribers', { email }, config);
            return response?.data;
        },

        unsubscribe: async (token, config) => {
            const response = await utils.$get('subscribers/unsubscribe', { token }, config);
            return response?.data;
        },
    };
};
