// The server stores UTC. Every date/time shown to customers is formatted in the shop's own
// tenant timezone (from GET /services/next's `timezone` field — specs/004-multi-tenant-supabase
// T033), not a fixed zone. This fallback only applies before that response has loaded.
export const DEFAULT_SHOP_TIME_ZONE = 'America/Los_Angeles'

const toDate = (value: string | Date) => (value instanceof Date ? value : new Date(value))

const format = (value: string | Date, timeZone: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-US', { timeZone, ...options }).format(toDate(value))

export const formatShopDate = (value: string | Date, timeZone: string = DEFAULT_SHOP_TIME_ZONE) =>
    format(value, timeZone, { weekday: 'long', month: 'long', day: 'numeric' })

export const formatShopTime = (value: string | Date, timeZone: string = DEFAULT_SHOP_TIME_ZONE) =>
    format(value, timeZone, { hour: 'numeric', minute: '2-digit' })

export const formatShopZone = (value: string | Date, timeZone: string = DEFAULT_SHOP_TIME_ZONE) =>
    format(value, timeZone, { timeZoneName: 'short' }).split(' ').pop() as string

export const formatShopRange = (start: string | Date, end: string | Date, timeZone: string = DEFAULT_SHOP_TIME_ZONE) => {
    const sameDay = formatShopDate(start, timeZone) === formatShopDate(end, timeZone)
    const endPart = sameDay ? formatShopTime(end, timeZone) : `${formatShopDate(end, timeZone)}, ${formatShopTime(end, timeZone)}`
    return `${formatShopDate(start, timeZone)}, ${formatShopTime(start, timeZone)} – ${endPart} ${formatShopZone(end, timeZone)}`
}
