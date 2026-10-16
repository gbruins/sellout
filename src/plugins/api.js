import axios from 'axios';
import qs from 'qs';
import isObject from 'lodash.isobject';
import Auth from '@/api/auth';
import Cart from '@/api/cart';
import Service from '@/api/service';
import { getCartCredentials } from '@/utils/cartCredentials';
import { useCartNoticeStore } from '@/stores/cartNotice';

export let axiosInstance = null;

export default {
    install: (app) => {
        const baseURL = import.meta.env.VITE_API_BASE_URL;
        const apiUser = import.meta.env.VITE_API_USER || 'store';
        const apiKey = import.meta.env.VITE_API_KEY;

        axiosInstance = axios.create({
            baseURL: baseURL,
            headers: {
                'Content-Type': 'application/json',
                ...(apiKey ? { Authorization: `Basic ${btoa(`${apiUser}:${apiKey}`)}` } : {}),
            },
        });

        axiosInstance.interceptors.request.use((config) => {
            const { token } = getCartCredentials();

            if (token) {
                config.headers['X-Cart-Token'] = token;
            }

            return config;
        });

        const utils = {};

        // GET
        utils.get = (url, params, config) => {
            const cfg = {
                paramsSerializer: (parameters) => {
                    // return qs.stringify(parameters, { indices: false });
                    return qs.stringify(parameters, { arrayFormat: 'brackets' });
                },
                ...config
            }

            if(isObject(params)) {
                cfg.params = params;
            }

            return axiosInstance.get(url, cfg);
        };

        utils.$get = async (url, params, config) => {
            const response = await utils.get(url, params, config);
            return response?.data;
        };


        // POST
        utils.post = (url, params, config) => {
            return axiosInstance.post(url, params, config);
        };

        utils.$post = async (url, params, config) => {
            const response = await utils.post(url, params, config);
            return response?.data;
        };


        // PUT
        utils.put = (url, params, config) => {
            return axiosInstance.put(url, params, config);
        };

        utils.$put = async (url, params, config) => {
            const response = await utils.put(url, params, config);
            return response?.data;
        };


        // DELETE
        utils.delete = (url, params, config) => {
            const cfg = { ...config };

            if(isObject(params)) {
                cfg.params = params;
            }

            return axiosInstance.delete(url, cfg);
        };

        utils.$delete = async (url, params, config) => {
            const response = await utils.delete(url, params, config);
            return response?.data;
        };


        // MISC
        utils.getCancelToken = () => {
            const { CancelToken } = axiosInstance;
            return CancelToken
        };

        utils.getCancelTokenSource = () => {
            return axiosInstance.CancelToken.source();
        };

        utils.makeCruds = (searchPath, singlePath) => {
            return {
                create: (data, config) => {
                    return utils.$post(singlePath, data, config);
                },

                read: (id, config) => {
                    return utils.$get(singlePath, { id }, config);
                },

                update: (data, config) => {
                    return utils.$put(singlePath, data, config);
                },

                delete: (id, config) => {
                    return utils.$delete(singlePath, { id }, config);
                },

                search: (params, config) => {
                    return utils.$get(searchPath, params, config);
                },
            }
        }

        app.provide('$api', {
            auth: Auth(utils, axiosInstance),
            cart: Cart(utils, axiosInstance),
            service: Service(utils, axiosInstance)
        });

        axiosInstance.interceptors.response.use(
            (response) => {
                // The server empties a cart left over from an ended service and says so once
                if(response?.data?.data?.cart_reset === 'service_ended') {
                    useCartNoticeStore().showReset();
                }

                return response;
            },
            (error) => {
                if (error.response) {
                    const errorCode = parseInt(error?.response?.status, 10);

                    switch (errorCode) {
                        case 401:
                            console.error('Unauthorized');
                            break;
                    }
                }

                return Promise.reject(error);
            }
        );
    }
}
