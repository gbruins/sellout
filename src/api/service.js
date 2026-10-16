export default (utils) => {
    return {
        // Current or next service state: status, remaining pizzas, menu
        getNext: async (config) => {
            const response = await utils.$get('services/next', null, config);
            return response?.data;
        },
    };
};
