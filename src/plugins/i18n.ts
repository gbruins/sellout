import { createI18n } from 'vue-i18n'
import enUS from '@/locales/en-US'

export const DEFAULT_LOCALE = 'en-US'

export type MessageSchema = typeof enUS

// A single instance, so code outside components (router titles, toasts) can use i18n.global.t
export const i18n = createI18n<[MessageSchema], 'en-US', false>({
    legacy: false,
    globalInjection: true,
    locale: DEFAULT_LOCALE,
    fallbackLocale: DEFAULT_LOCALE,
    messages: { 'en-US': enUS },
    numberFormats: {
        'en-US': {
            // Prices are shown as plain amounts ("20.00"), never with a currency symbol
            price: { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true },
        },
    },
})
