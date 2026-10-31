<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive } from 'vue'
import { toast } from 'vue-sonner'
import { useServiceStore, type MenuProduct } from '@/stores/service'
import { useCartStore } from '@/stores/cart'
import AcceptingOrdersHero from '@/components/AcceptingOrdersHero.vue'
import AddedToCartPopup from '@/components/AddedToCartPopup.vue'
import PizzaList from '@/components/PizzaList.vue'
import ServiceClosedCard from '@/components/ServiceClosedCard.vue'
import ServiceStatusNotice from '@/components/ServiceStatusNotice.vue'

const service = useServiceStore()
const cart = useCartStore()

onMounted(async () => {
    await service.load()
    service.connect()
})

onBeforeUnmount(() => service.disconnect())

const isOpen = computed(() => service.status === 'open' || service.status === 'sold_out')
const isClosed = computed(() => service.status === 'upcoming' || service.status === 'none')

const addedPopup = reactive<{ open: boolean, title: string, qty: number, price: number | null }>({
    open: false,
    title: '',
    qty: 1,
    price: null,
})

async function onOrder(pizza: MenuProduct, qty: number) {
    await cart.addPizza(pizza, qty)

    if (cart.error) {
        toast.error(cart.error)
        cart.clearError()
    }
    else {
        addedPopup.title = pizza.title
        addedPopup.qty = qty
        addedPopup.price = pizza.base_price != null ? pizza.base_price * qty : null
        addedPopup.open = true
    }
}
</script>

<template>
    <ServiceStatusNotice
        v-if="service.error || service.stale || (service.loading && !service.status)"
        :loading="service.loading"
        :error="service.error || service.stale"
        @retry="service.retry()"
    />

    <template v-if="isOpen">
        <AcceptingOrdersHero :remaining="service.remaining" :total="service.total" />
        <ServiceClosedCard v-if="service.status === 'sold_out'" sold-out :service="service.nextService" />
        <PizzaList
            :menu="service.menu"
            :disabled="service.status === 'sold_out' || !!cart.busy"
            :max-per-order="service.service?.max_per_order"
            :remaining="service.remaining"
            @order="onOrder"
        />
    </template>

    <ServiceClosedCard v-else-if="isClosed" :service="service.service" />

    <AddedToCartPopup
        v-model:open="addedPopup.open"
        :title="addedPopup.title"
        :qty="addedPopup.qty"
        :price="addedPopup.price"
    />
</template>
