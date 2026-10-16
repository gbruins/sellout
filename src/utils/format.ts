// Prices are stored in cents
export const formatPrice = (cents: number) => {
    if(!Number.isFinite(cents)) {
        return '';
    }

    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
};
