import { onBeforeUnmount, ref, watch, type Ref } from 'vue'
import { loadStripe, type StripeEmbeddedCheckout } from '@stripe/stripe-js'

/**
 * Mounts Stripe's Embedded Checkout into `container` whenever `clientSecret` is set, and
 * tears it down when the secret clears or the caller unmounts. The server hands back the same
 * session for a cart that is already checking out, so remounting after a reload is safe.
 */
export function useStripeEmbeddedCheckout(container: Ref<HTMLElement | null>, clientSecret: Ref<string | null>) {
    const mounted = ref(false)
    let instance: StripeEmbeddedCheckout | null = null
    let disposed = false

    function destroy() {
        instance?.destroy()
        instance = null
        mounted.value = false
    }

    // flush: 'post' so the container rendered alongside the secret is already in the DOM
    watch([clientSecret, container], async ([secret, el]) => {
        destroy()

        if(!secret || !el) {
            return
        }

        const stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
        if(!stripe || disposed || clientSecret.value !== secret) {
            return
        }

        const checkout = await stripe.createEmbeddedCheckoutPage({ fetchClientSecret: () => Promise.resolve(secret) })

        // The visitor may have left or cancelled while Stripe was loading
        if(disposed || clientSecret.value !== secret || container.value !== el) {
            checkout.destroy()
            return
        }

        instance = checkout
        checkout.mount(el)
        mounted.value = true
    }, { flush: 'post', immediate: true })

    onBeforeUnmount(() => {
        disposed = true
        destroy()
    })

    return { mounted, destroy }
}
