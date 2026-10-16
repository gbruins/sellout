// The server stores UTC. The shop is in Los Angeles, so every date and time shown to
// customers is formatted in that zone, whatever the visitor's device zone is.
export const SHOP_TIME_ZONE = 'America/Los_Angeles'

const toDate = (value: string | Date) => (value instanceof Date ? value : new Date(value))

const format = (value: string | Date, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-US', { timeZone: SHOP_TIME_ZONE, ...options }).format(toDate(value))

export const formatShopDate = (value: string | Date) =>
    format(value, { weekday: 'long', month: 'long', day: 'numeric' })

export const formatShopTime = (value: string | Date) =>
    format(value, { hour: 'numeric', minute: '2-digit' })

export const formatShopZone = (value: string | Date) =>
    format(value, { timeZoneName: 'short' }).split(' ').pop() as string

export const formatShopRange = (start: string | Date, end: string | Date) => {
    const sameDay = formatShopDate(start) === formatShopDate(end)
    const endPart = sameDay ? formatShopTime(end) : `${formatShopDate(end)}, ${formatShopTime(end)}`
    return `${formatShopDate(start)}, ${formatShopTime(start)} – ${endPart} ${formatShopZone(end)}`
}
