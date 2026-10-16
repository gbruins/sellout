import { useAppStore } from '@/stores/app';
import { axiosInstance } from '@/plugins/api';

export default {
    install: async (app) => {

        async function fetchConfig() {
            const appStore = useAppStore();

            try {
                const response = await Promise.all([
                    axiosInstance.get('/allowed_streets'),
                    axiosInstance.get('/product_types')
                ]);

                appStore.allowedStreets = response[0].data?.data || [];
                appStore.productTypes = response[1].data?.data || [];
            }
            catch (error) {
                console.error('Failed to fetch config:', error);
            }
        }

        await fetchConfig();
    }
}
