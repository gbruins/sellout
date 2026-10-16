import { describe, expect, it } from 'vitest'
import { formatShopDate, formatShopRange, formatShopTime, formatShopZone } from '../shopTime'

describe('shopTime', () => {
    it('formats in Los Angeles standard time (PST) in winter', () => {
        const t = '2026-01-10T02:30:00.000Z'
        expect(formatShopDate(t)).toBe('Friday, January 9')
        expect(formatShopTime(t)).toBe('6:30 PM')
        expect(formatShopZone(t)).toBe('PST')
    })

    it('formats in daylight time (PDT) in summer, a different UTC offset', () => {
        const t = '2026-07-10T02:30:00.000Z'
        expect(formatShopTime(t)).toBe('7:30 PM')
        expect(formatShopZone(t)).toBe('PDT')
    })

    it('switches offset across the daylight saving change (2026-03-08)', () => {
        expect(formatShopTime('2026-03-08T09:59:00.000Z')).toBe('1:59 AM')
        expect(formatShopTime('2026-03-08T10:00:00.000Z')).toBe('3:00 AM')
    })

    it('does not depend on the device time zone', () => {
        const original = process.env.TZ
        process.env.TZ = 'Asia/Tokyo'
        expect(formatShopTime('2026-07-10T02:30:00.000Z')).toBe('7:30 PM')
        process.env.TZ = original
    })

    it('formats a range, repeating the date when it spans midnight', () => {
        expect(formatShopRange('2026-10-16T20:00:00.000Z', '2026-10-17T02:00:00.000Z'))
            .toBe('Friday, October 16, 1:00 PM – 7:00 PM PDT')
        expect(formatShopRange('2026-10-17T05:00:00.000Z', '2026-10-17T08:00:00.000Z'))
            .toBe('Friday, October 16, 10:00 PM – Saturday, October 17, 1:00 AM PDT')
    })
})
