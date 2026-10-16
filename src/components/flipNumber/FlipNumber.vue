

<script setup lang="ts">
import { ref, watch } from 'vue'
import FlipNumberItem from './FlipNumberItem.vue'

defineOptions({ name: 'FlipNumber' })

const props = defineProps({
    value: {
        type: String,
        required: true,
        default: '0',
    },
    speed: {
        type: [Number, String],
        default: 600,
    },
})

const numbersSplitted = ref<Array<number | string>>([])

if (Number.isNaN(Number(props.speed))) {
    console.error('the prop speed is not a number')
}

function splitValue() {
    numbersSplitted.value = []
    if (isNaN(Number(props.value))) {
        console.error('the prop must be a number')
        return
    }

    const valueSplittedArr = props.value.toString().split('')
    for (const value of valueSplittedArr) {
        if (isNaN(Number(value))) {
            numbersSplitted.value.push(value)
        } else {
            numbersSplitted.value.push(Number(value))
        }
    }
}

splitValue()
watch(() => props.value, splitValue)
</script>

<template>
    <div class="flip-number">
        <template v-for="(item, index) in numbersSplitted" :key="index">
            <FlipNumberItem
                v-if="typeof item === 'number'"
                :value="item"
                :speed="props.speed"
                class="loop-item"
            />
            <div v-else class="loop-item sign">{{ item }}</div>
        </template>
    </div>
</template>

<style scoped>
.loop-item {
  display: inline-block;
}
</style>
