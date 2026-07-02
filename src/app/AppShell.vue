<template>
  <div class="app-shell">
    <aside class="app-sidebar">
      <AppNav />
    </aside>

    <main class="app-main">
      <div class="page-stack">
        <slot />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import AppNav from '@/components/layout/AppNav.vue';
</script>
