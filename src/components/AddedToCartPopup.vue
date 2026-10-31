<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'
import { CircleCheckIcon, ShoppingCartIcon, XIcon } from '@lucide/vue'
import { formatPrice } from '@/utils/format'
import { useCartStore } from '@/stores/cart'
import { Button } from '@/components/ui/button'

const props = defineProps<{ open: boolean, title: string, qty: number, price: number | null }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const router = useRouter()
const cart = useCartStore()

// Longer than the small toast it replaces — there's more to read, and two real decisions to
// make (View Cart / Checkout), not just a glance-and-forget confirmation.
const AUTO_DISMISS_MS = 8000
let timer: ReturnType<typeof setTimeout> | null = null

function clearTimer() {
    if(timer) {
        clearTimeout(timer)
        timer = null
    }
}

function close() {
    clearTimer()
    emit('update:open', false)
}

watch(() => props.open, (isOpen) => {
    clearTimer()
    if(isOpen) {
        timer = setTimeout(close, AUTO_DISMISS_MS)
    }
})

onBeforeUnmount(clearTimer)

function viewCart() {
    close()
    router.push('/cart')
}

// Mounting Stripe's embedded form here isn't practical (not enough room), and /cart already has
// the space and the order summary — so Checkout navigates there and kicks off payment at the
// same time, rather than making the visitor click Pay again once they arrive.
function checkout() {
    close()
    router.push('/cart')
    cart.pay()
}
</script>

<template>
    <Teleport to="body">
        <Transition
            enter-active-class="transition-opacity duration-200 ease-out"
            enter-from-class="opacity-0"
            leave-active-class="transition-opacity duration-200 ease-in"
            leave-to-class="opacity-0">
            <div v-if="open" class="fixed inset-0 z-50" role="status" aria-live="polite">
                <div class="absolute inset-0 bg-black/30" aria-hidden="true" @click="close" />

                <div class="absolute right-4 top-4 w-[calc(100%-2rem)] max-w-sm rounded-lg border border-border bg-card p-5 shadow-xl sm:right-6 sm:top-6" data-test="added-to-cart-popup">
                    <div class="flex items-start justify-between gap-3">
                        <p class="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <CircleCheckIcon class="size-5 text-sage" aria-hidden="true" />
                            Added to cart
                        </p>
                        <button type="button" aria-label="Dismiss" data-test="dismiss" class="text-muted-foreground hover:text-foreground" @click="close">
                            <XIcon class="size-4" />
                        </button>
                    </div>

                    <div class="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
                        <div class="min-w-0">
                            <p class="truncate font-heading text-base font-semibold text-foreground">{{ title }}</p>
                            <p class="text-sm text-muted-foreground">Qty {{ qty }}</p>
                        </div>
                        <p v-if="price != null" class="shrink-0 font-heading text-base font-semibold text-primary">{{ formatPrice(price).replace('$', '') }}</p>
                    </div>

                    <div class="mt-5 flex flex-col gap-2">
                        <Button type="button" variant="outline" class="w-full" size="lg" data-test="view-cart" @click="viewCart">
                            View Cart ({{ cart.count }})
                        </Button>
                        <Button type="button" class="w-full bg-primary text-primary-foreground hover:bg-primary/90" size="lg" data-test="checkout" @click="checkout">
                            Checkout
                            <ShoppingCartIcon class="size-4" aria-hidden="true" />
                        </Button>
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>
