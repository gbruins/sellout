import { describe, expect, it } from 'vitest'
import { groupMenuProducts } from '../menuSections'

const pizza = (id: string) => ({ id, title: id, description: null, base_price: 2000, product_type: 1, type_name: 'Pizza', limited: true })
const drink = (id: string) => ({ id, title: id, description: null, base_price: 300, product_type: 2, type_name: 'Drinks', limited: false })

describe('groupMenuProducts', () => {
    it('makes one section per type, in the order each type first appears on the menu', () => {
        const sections = groupMenuProducts([pizza('cheese'), drink('soda'), pizza('pepperoni')])

        expect(sections.map((s) => s.title)).toEqual(['Pizza', 'Drinks'])
        expect(sections[0]!.products.map((p) => p.id)).toEqual(['cheese', 'pepperoni'])
        expect(sections[1]!.products.map((p) => p.id)).toEqual(['soda'])
    })

    it('puts a type first when its first product comes first', () => {
        expect(groupMenuProducts([drink('soda'), pizza('cheese')]).map((s) => s.title)).toEqual(['Drinks', 'Pizza'])
    })

    it('marks sections that hold limited products', () => {
        const [pizzas, drinks] = groupMenuProducts([pizza('cheese'), drink('soda')])

        expect(pizzas!.limited).toBe(true)
        expect(drinks!.limited).toBe(false)
    })

    it('keeps products without type info together in one untitled section', () => {
        const sections = groupMenuProducts([
            { id: 'a', title: 'A', description: null, base_price: 100 },
            { id: 'b', title: 'B', description: null, base_price: 100 },
        ])

        expect(sections).toHaveLength(1)
        expect(sections[0]!.title).toBeNull()
        expect(sections[0]!.limited).toBe(true)
    })

    it('returns no sections for an empty menu', () => {
        expect(groupMenuProducts([])).toEqual([])
    })
})
