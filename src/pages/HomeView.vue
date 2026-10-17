<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useServiceStore } from '@/stores/service'
import { useCartStore } from '@/stores/cart'
import PizzaInventoryMatrix from '@/components/PizzaInventoryMatrix.vue'
import PizzaRemainingCountdown from '@/components/PizzaRemainingCountdown.vue'
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
</script>

<template>
    <ServiceStatusNotice
        v-if="service.error || service.stale || (service.loading && !service.status)"
        :loading="service.loading"
        :error="service.error || service.stale"
        @retry="service.retry()"
    />

    <template v-if="isOpen">
        <PizzaRemainingCountdown :remaining="service.remaining" :total="service.total" />
        <PizzaInventoryMatrix :total="service.total" :remaining="service.remaining" />
        <ServiceClosedCard v-if="service.status === 'sold_out'" sold-out :service="service.nextService" />
        <p v-if="cart.error" role="alert" data-test="cart-error" class="mx-auto mb-4 max-w-4xl border border-red-800 px-3 py-2 text-sm text-red-300">
            {{ cart.error }}
        </p>
        <PizzaList :menu="service.menu" :disabled="service.status === 'sold_out' || !!cart.busy" @order="cart.addPizza($event)" />
    </template>

    <ServiceClosedCard v-else-if="isClosed" :service="service.service" />
</template>
