<script setup lang="ts">
import { RouterView } from 'vue-router'
import DefaultLayout from '@/layouts/DefaultLayout.vue';
</script>

<template>
    <component :is="$route.meta.layout || DefaultLayout">
        <router-view />
    </component>
</template>
