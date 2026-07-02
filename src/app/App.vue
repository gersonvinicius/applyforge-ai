<script setup lang="ts">
import { onMounted } from 'vue';
import AppShell from '@/app/AppShell.vue';
import { useWorkspaceStore } from '@/stores/workspace';

const workspace = useWorkspaceStore();

onMounted(async () => {
  await workspace.seedLocalWorkspace();
});
</script>

<template>
  <AppShell>
    <RouterView />
  </AppShell>
</template>
