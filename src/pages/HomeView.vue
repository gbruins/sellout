<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import type { MenuProduct } from '@/api'
import { useServiceStore } from '@/stores/service'
import { useCartStore } from '@/stores/cart'
import MobileCartBar from '@/components/MobileCartBar.vue'
import OpenHero from '@/components/OpenHero.vue'
import PizzaList from '@/components/PizzaList.vue'
import ServiceClosedCard from '@/components/ServiceClosedCard.vue'
import ServiceStatusNotice from '@/components/ServiceStatusNotice.vue'

const service = useServiceStore()
const cart = useCartStore()
const router = useRouter()
const { t } = useI18n()

const isClosed = computed(() => service.status === 'upcoming' || service.status === 'none')

const addingId = ref<string | null>(null)

async function onOrder(pizza: MenuProduct, qty: number) {
    addingId.value = pizza.id
    const added = await cart.addPizza(pizza, qty)
    addingId.value = null

    if(added) {
        toast.success(t('menu.added', { title: pizza.title, n: qty }, qty), {
            action: { label: t('menu.viewCart'), onClick: () => router.push('/cart') },
        })
    }
    else if(cart.error) {
        toast.error(t(cart.error.key, cart.error.params ?? {}, cart.error.plural ?? 1))
        cart.clearError()
    }
}
</script>

<template>
    <div :class="{ 'pb-20 sm:pb-0': cart.count > 0 }">
        <ServiceStatusNotice
            v-if="service.error || service.stale || (service.loading && !service.status)"
            :loading="service.loading"
            :error="service.error || service.stale"
            @retry="service.retry()"
        />

        <template v-if="service.status === 'open'">
            <OpenHero />
            <PizzaList
                :menu="service.menu"
                :disabled="!!cart.busy"
                :adding-id="addingId"
                :max-per-order="service.service?.max_per_order"
                :remaining="service.remaining"
                @order="onOrder"
            />
        </template>

        <!-- Sold out: say so first (with the next service), and keep the menu visible but disabled -->
        <template v-else-if="service.status === 'sold_out'">
            <ServiceClosedCard sold-out :service="service.nextService" />
            <PizzaList :menu="service.menu" disabled />
        </template>

        <ServiceClosedCard v-else-if="isClosed" :service="service.service" />

        <MobileCartBar />
    </div>
</template>
