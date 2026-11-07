import { useAppStore } from '@/stores/app';
import { axiosInstance } from '@/plugins/api';

export default {
    install: async (app) => {

        async function fetchConfig() {
            const appStore = useAppStore();

            try {
                const response = await axiosInstance.get('/product_types');
                appStore.productTypes = response.data?.data || [];
            }
            catch (error) {
                console.error('Failed to fetch config:', error);
            }
        }

        await fetchConfig();
    }
}
