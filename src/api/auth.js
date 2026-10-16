export default (utils) => {
    return {
        login: (data, config) => {
            return utils.$post('auth/login', data, config);
        },

        logout: (data, config) => {
            return utils.$post('auth/logout', null, config);
        },
    }
}
