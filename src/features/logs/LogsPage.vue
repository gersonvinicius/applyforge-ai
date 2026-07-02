<script setup lang="ts">
import SectionCard from '@/components/ui/SectionCard.vue';
import { useWorkspaceStore } from '@/stores/workspace';
import { formatDateTime } from '@/utils/date';

const workspace = useWorkspaceStore();
</script>

<template>
  <div class="page-stack">
    <header class="page-header">
      <div>
        <h1 class="page-title">Logs locais</h1>
        <p class="page-subtitle">
          O objetivo e manter rastreabilidade do fluxo de IA, importacao, PDF e backup sem depender de observabilidade server-side.
        </p>
      </div>
      <button class="btn btn-secondary" type="button">Definir filtros</button>
    </header>

    <SectionCard title="Eventos recentes" subtitle="Cada log continua exportavel no backup do workspace.">
      <table class="table">
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Status</th>
            <th>Mensagem</th>
            <th>Data</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in workspace.recentLogs" :key="log.id">
            <td>{{ log.type }}</td>
            <td>{{ log.status }}</td>
            <td>{{ log.message }}</td>
            <td>{{ formatDateTime(log.createdAt) }}</td>
          </tr>
        </tbody>
      </table>
    </SectionCard>
  </div>
</template>
