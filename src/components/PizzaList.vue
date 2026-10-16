<script setup lang="ts">
interface PizzaProfile {
    id: string
    name: string
    description: string
}

const pizzas: PizzaProfile[] = [
    {
        id: 'margherita',
        name: 'The Margherita',
        description: 'Crushed San Marzano tomatoes, fresh mozzarella, basil, and a little olive oil.',
    },
    {
        id: 'hot-honey-pepperoni',
        name: 'Hot Honey Pepperoni',
        description: 'Crisp pepperoni, mozzarella, and house hot honey over a slow-simmered tomato sauce.',
    },
    {
        id: 'wild-truffle-funghi',
        name: 'Wild Truffle Funghi',
        description: 'Roasted mushrooms, creamy mozzarella, thyme, and a touch of truffle oil.',
    },
    {
        id: 'marinara-stracciatella',
        name: 'Marinara Stracciatella',
        description: 'Garlic tomato, oregano, chili, and cool stracciatella added after the bake.',
    },
]

const emit = defineEmits<{
    order: [pizza: PizzaProfile]
}>()
</script>

<template>
    <section class="mx-auto w-full max-w-4xl" aria-labelledby="pizza-list-title">
        <div class="mb-5 flex items-end justify-between gap-4 border-b border-zinc-800 pb-3 sm:mb-6">
            <div>
                <p class="mb-1 font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-orange-500">
                    Tonight's selection
                </p>
                <h2 id="pizza-list-title" class="text-xl font-bold uppercase text-zinc-100 sm:text-2xl">
                    Four profiles
                </h2>
            </div>
            <p class="hidden font-mono text-[10px] uppercase tracking-wider text-zinc-500 sm:block">
                Made fresh to order
            </p>
        </div>

        <ul class="divide-y divide-zinc-800 border-y border-zinc-800">
            <li v-for="pizza in pizzas" :key="pizza.id" class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-l-2 border-transparent px-3 py-5 transition-colors duration-200 hover:border-l-orange-500 hover:bg-zinc-900 sm:gap-8 sm:py-6">
                <div class="min-w-0">
                    <h3 class="text-base font-bold uppercase leading-tight text-zinc-100 sm:text-lg">
                        {{ pizza.name }}
                    </h3>
                    <p class="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
                        {{ pizza.description }}
                    </p>
                </div>

                <button
                    class="shrink-0 border border-orange-700 px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-wider text-orange-500 transition-colors hover:bg-orange-600 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 sm:px-4 sm:text-[10px]"
                    type="button"
                    @click="emit('order', pizza)"
                >
                    Order now
                </button>
            </li>
        </ul>
    </section>
</template>
