<script setup lang="ts">
defineProps<{
  title: string;
  subtitle?: string;
}>();
</script>

<template>
  <section class="card">
    <div class="card-body">
      <div style="display: flex; justify-content: space-between; gap: 18px; align-items: flex-start;">
        <div>
          <h2 class="card-title">{{ title }}</h2>
          <p v-if="subtitle" class="card-subtitle">{{ subtitle }}</p>
        </div>
        <slot name="actions" />
      </div>

      <div class="stack-md" style="margin-top: 18px;">
        <slot />
      </div>
    </div>
  </section>
</template>
