import { i18n } from '@/plugins/i18n'

// The server stores UTC. Every date/time shown to customers is formatted in the shop's own
// tenant timezone (from GET /services/next's `timezone` field — specs/004-multi-tenant-supabase
// T033), not a fixed zone. This fallback only applies before that response has loaded.
export const DEFAULT_SHOP_TIME_ZONE = 'America/Los_Angeles'

const toDate = (value: string | Date) => (value instanceof Date ? value : new Date(value))

const format = (value: string | Date, timeZone: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(i18n.global.locale.value, { timeZone, ...options }).format(toDate(value))

export const formatShopDate = (value: string | Date, timeZone: string = DEFAULT_SHOP_TIME_ZONE) =>
    format(value, timeZone, { weekday: 'long', month: 'long', day: 'numeric' })

export const formatShopTime = (value: string | Date, timeZone: string = DEFAULT_SHOP_TIME_ZONE) =>
    format(value, timeZone, { hour: 'numeric', minute: '2-digit' })

export const formatShopZone = (value: string | Date, timeZone: string = DEFAULT_SHOP_TIME_ZONE) =>
    format(value, timeZone, { timeZoneName: 'short' }).split(' ').pop() as string

// Split into the start date and the times so they can be shown on separate lines. A range that
// spans midnight repeats the end date inside `times`.
export const formatShopRange = (start: string | Date, end: string | Date, timeZone: string = DEFAULT_SHOP_TIME_ZONE) => {
    const date = formatShopDate(start, timeZone)
    const sameDay = date === formatShopDate(end, timeZone)
    const endPart = sameDay ? formatShopTime(end, timeZone) : `${formatShopDate(end, timeZone)}, ${formatShopTime(end, timeZone)}`
    return { date, times: `${formatShopTime(start, timeZone)} – ${endPart} ${formatShopZone(end, timeZone)}` }
}
