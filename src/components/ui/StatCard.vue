<script setup lang="ts">
defineProps<{
  label: string;
  value: string | number;
  hint?: string;
}>();
</script>

<template>
  <article class="card">
    <div class="card-body">
      <p class="muted" style="margin: 0; font-size: 0.86rem; text-transform: uppercase; letter-spacing: 0.08em;">{{ label }}</p>
      <p style="margin: 12px 0 6px; font-size: 2rem; font-weight: 800; line-height: 1;">{{ value }}</p>
      <p v-if="hint" class="muted" style="margin: 0;">{{ hint }}</p>
    </div>
  </article>
</template>
