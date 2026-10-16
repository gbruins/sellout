<script setup lang="ts">
import { ref } from 'vue'
import PizzaInventoryMatrix from '@/components/PizzaInventoryMatrix.vue';
import PizzaRemainingCountdown from '@/components/PizzaRemainingCountdown.vue';
import PizzaList from '@/components/PizzaList.vue';

const pizzasRemaining = ref(30);
const totalInventory = ref(60);
</script>

<template>
    <PizzaRemainingCountdown :remaining="pizzasRemaining" />
    <PizzaInventoryMatrix :total="totalInventory" :remaining="pizzasRemaining" />
    <PizzaList />
</template>
