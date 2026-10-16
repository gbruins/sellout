
<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'

defineOptions({ name: 'FlipNumberItem' })

const props = defineProps<{
    value: number
    speed: number | string
}>()

const frontCount = ref(props.value)
const backCount = ref(props.value)
const animationClass = ref('')
const isFlipping = ref(false)
let flipTimer: ReturnType<typeof setTimeout> | undefined
const flipSequence = ref(0)

watch(() => props.value, (value) => {
    const sequence = ++flipSequence.value
    if (flipTimer) clearTimeout(flipTimer)

    frontCount.value = isFlipping.value ? backCount.value : frontCount.value
    backCount.value = value
    isFlipping.value = true
    animationClass.value = 'down go'
    flipTimer = setTimeout(() => {
        if (sequence !== flipSequence.value) return

        animationClass.value = 'down'
        isFlipping.value = false
        frontCount.value = backCount.value
        flipTimer = undefined
    }, Number(props.speed))
})

onBeforeUnmount(() => {
    flipSequence.value++
    if (flipTimer) clearTimeout(flipTimer)
})
</script>

<template>
    <div class="flip-number-item">
        <div :key="flipSequence" class="flip" :class="animationClass">
            <div class="digital front" :class="`number${frontCount}`"></div>
            <div class="digital back" :class="`number${backCount}`"></div>
        </div>
    </div>
</template>

<style scoped>
.flip {
  display: inline-block;
  position: relative;
  width: 5.5rem;
  height: 8rem;
  line-height: 8rem;
  border: solid 1px #000;
  border-radius: 10px;
  background: #fff;
  font-size: 6rem;
  color: #fff;
  text-align: center;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-weight: 700;
}

@media (min-width: 640px) {
  .flip {
    width: 11rem;
    height: 13rem;
    font-size: 9rem;
    line-height: 13rem;
  }
}

.flip .digital:before,
.flip .digital:after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  background: #000;
  overflow: hidden;
  box-sizing: border-box;
}

.flip .digital:before {
  top: 0;
  bottom: 50%;
  /* border-radius: 10px 10px 0 0; */
  border-bottom: solid 1px #666;
}

.flip .digital:after {
  top: 50%;
  bottom: 0;
  /* border-radius: 0 0 10px 10px; */
  line-height: 0;
}

/*向下翻*/
.flip.down .front:before {
  z-index: 3;
}

.flip.down .back:after {
  z-index: 2;
  transform-origin: 50% 0%;
  transform: perspective(160px) rotateX(180deg);
}

.flip.down .front:after,
.flip.down .back:before {
  z-index: 1;
}

.flip.down.go .front:before {
  transform-origin: 50% 100%;
  animation: frontFlipDown 0.3s ease-in-out both;
  /* box-shadow: 0 -2px 6px rgba(255, 255, 255, 0.3); */
  backface-visibility: hidden;
}

.flip.down.go .back:after {
  animation: backFlipDown 0.3s ease-in-out both;
}

@keyframes frontFlipDown {
  0% {
    transform: perspective(160px) rotateX(0deg);
  }

  100% {
    transform: perspective(160px) rotateX(-180deg);
  }
}

@keyframes backFlipDown {
  0% {
    transform: perspective(160px) rotateX(180deg);
  }

  100% {
    transform: perspective(160px) rotateX(0deg);
  }
}

.flip .number0:before,
.flip .number0:after {
  content: '0';
}

.flip .number1:before,
.flip .number1:after {
  content: '1';
}

.flip .number2:before,
.flip .number2:after {
  content: '2';
}

.flip .number3:before,
.flip .number3:after {
  content: '3';
}

.flip .number4:before,
.flip .number4:after {
  content: '4';
}

.flip .number5:before,
.flip .number5:after {
  content: '5';
}

.flip .number6:before,
.flip .number6:after {
  content: '6';
}

.flip .number7:before,
.flip .number7:after {
  content: '7';
}

.flip .number8:before,
.flip .number8:after {
  content: '8';
}

.flip .number9:before,
.flip .number9:after {
  content: '9';
}
</style>
