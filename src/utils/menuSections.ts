import type { MenuProduct } from '@/api'

export interface MenuSection {
    key: string
    // The product type's name; null when the server sent no type info
    title: string | null
    // Whether the section holds products that count toward max_per_order (pizzas)
    limited: boolean
    products: MenuProduct[]
}

// Only pizzas count toward the cap and stock. A product without the flag is treated as
// limited, which is the safe side.
export const isLimited = (product: MenuProduct) => product.limited !== false

/**
 * Groups menu products into one section per product type. Sections follow the menu's own
 * order (a type appears where its first product does) and products keep their order.
 */
export function groupMenuProducts(products: MenuProduct[]): MenuSection[] {
    const sections = new Map<string, MenuSection>()

    for(const product of products) {
        const key = product.product_type == null ? 'untyped' : String(product.product_type)
        let section = sections.get(key)

        if(!section) {
            section = { key, title: key === 'untyped' ? null : (product.type_name ?? null), limited: false, products: [] }
            sections.set(key, section)
        }

        section.products.push(product)
        section.limited ||= isLimited(product)
    }

    return [...sections.values()]
}
