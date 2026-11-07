<script setup lang="ts">
import { computed } from 'vue'
import { MapPinIcon, PhoneIcon } from '@lucide/vue'
import { useServiceStore } from '@/stores/service'

// Where to pick up, from the shop's own address (set by the owner in the admin app). Renders
// nothing until an address exists.
// `compact` drops the state and zip: customers of a local shop know where it is, and the
// street and city are enough to recognise it. The directions link always uses the full address.
const props = withDefaults(defineProps<{ tone?: 'default' | 'inverted', compact?: boolean }>(), { tone: 'default', compact: false })

const service = useServiceStore()

const addressLines = (full: boolean) => {
    const shop = service.shop
    if(!shop?.address_line1) {
        return []
    }

    const locality = full
        ? [shop.address_city, [shop.address_state, shop.address_postal_code].filter(Boolean).join(' ')].filter(Boolean).join(', ')
        : shop.address_city

    return [shop.address_line1, shop.address_line2, locality].filter((line): line is string => !!line)
}

const lines = computed(() => addressLines(!props.compact))

const directionsUrl = computed(() =>
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addressLines(true).join(', '))}`)

const phone = computed(() => service.shop?.phone ?? null)
</script>

<template>
    <div v-if="lines.length" data-test="pickup-info" class="flex items-start gap-2 text-sm">
        <MapPinIcon class="mt-0.5 size-4 shrink-0" :class="tone === 'inverted' ? 'text-gold' : 'text-primary'" aria-hidden="true" />
        <div :class="tone === 'inverted' ? 'text-charcoal-foreground/80' : 'text-muted-foreground'">
            <p class="font-semibold" :class="tone === 'inverted' ? 'text-charcoal-foreground' : 'text-foreground'">{{ $t('pickup.heading') }}</p>
            <!-- Compact is one line where space is tight; each part stays whole, so a narrow
                 screen wraps at the comma, never mid-name. The full address stacks. -->
            <address v-if="compact" class="not-italic">
                <template v-for="(line, i) in lines" :key="line"><span class="whitespace-nowrap">{{ line }}{{ i < lines.length - 1 ? ',' : '' }}</span>{{ ' ' }}</template>
            </address>
            <address v-else class="not-italic">
                <span v-for="line in lines" :key="line" class="block">{{ line }}</span>
            </address>
            <p class="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                <a :href="directionsUrl" target="_blank" rel="noopener" class="font-semibold underline-offset-4 hover:underline" :class="tone === 'inverted' ? 'text-gold' : 'text-primary'">
                    {{ $t('pickup.directions') }}
                </a>
                <a v-if="phone" :href="`tel:${phone}`" class="inline-flex items-center gap-1 font-semibold underline-offset-4 hover:underline" :class="tone === 'inverted' ? 'text-gold' : 'text-primary'">
                    <PhoneIcon class="size-3.5" aria-hidden="true" />
                    {{ $t('pickup.call', { phone }) }}
                </a>
            </p>
        </div>
    </div>
</template>
