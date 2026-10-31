<script setup lang="ts">
import { RouterView } from 'vue-router'
import DefaultLayout from '@/layouts/DefaultLayout.vue';
import { Toaster } from '@/components/ui/sonner';
</script>

<template>
    <component :is="$route.meta.layout || DefaultLayout">
        <router-view />
    </component>
    <Toaster position="top-right" rich-colors />
</template>
