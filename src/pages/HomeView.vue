<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useServiceStore } from '@/stores/service'
import PizzaInventoryMatrix from '@/components/PizzaInventoryMatrix.vue'
import PizzaRemainingCountdown from '@/components/PizzaRemainingCountdown.vue'
import PizzaList from '@/components/PizzaList.vue'
import ServiceClosedCard from '@/components/ServiceClosedCard.vue'
import ServiceStatusNotice from '@/components/ServiceStatusNotice.vue'

const service = useServiceStore()

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
        <PizzaList :menu="service.menu" :disabled="service.status === 'sold_out'" />
    </template>

    <ServiceClosedCard v-else-if="isClosed" :service="service.service" />
</template>
