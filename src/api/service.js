export default (utils) => {
    return {
        // Current or next service state: status, remaining pizzas, menu
        getNext: async (config) => {
            const response = await utils.$get('services/next', null, config);
            return response?.data;
        },

        // Short-lived Supabase Realtime token for the live-updates subscription — { realtime_jwt, tenant_id }
        getRealtimeToken: async (config) => {
            const response = await utils.$post('services/next/realtime-token', null, config);
            return response?.data;
        },
    };
};
