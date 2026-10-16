<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import AppFooter from '../components/AppFooter.vue'
import AppHeader from '../components/AppHeader.vue'
import PizzaInventoryMatrix from '../components/PizzaInventoryMatrix.vue'
import PizzaRemainingCountdown from '../components/PizzaRemainingCountdown.vue'
import PizzaList from '../components/PizzaList.vue'

const pizzasRemaining = ref(30)
const saleInterval = 1_000
let saleTimeout: ReturnType<typeof setTimeout> | undefined

function scheduleSampleSale() {
	saleTimeout = setTimeout(() => {
		if (pizzasRemaining.value === 0) return

		pizzasRemaining.value -= 1
		if (pizzasRemaining.value > 0) scheduleSampleSale()
	}, saleInterval)
}

onMounted(scheduleSampleSale)
onUnmounted(() => clearTimeout(saleTimeout))
</script>

<template>
	<div class="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
		<AppHeader />

		<PizzaRemainingCountdown :remaining="pizzasRemaining" />
		<PizzaInventoryMatrix :total="60" :remaining="pizzasRemaining" />
        <PizzaList />
		<main class="w-full flex-1">
			<slot />
		</main>

		<AppFooter />
	</div>
</template>
