<script setup lang="ts">
import { computed } from 'vue';
import SectionCard from '@/components/ui/SectionCard.vue';
import StatCard from '@/components/ui/StatCard.vue';
import { useWorkspaceStore } from '@/stores/workspace';
import { formatDateTime } from '@/utils/date';

const workspace = useWorkspaceStore();

const profileName = computed(() => workspace.profile?.fullName || 'Workspace local');
</script>

<template>
  <div class="page-stack">
    <header class="page-header">
      <div>
        <h1 class="page-title">Dashboard local-first</h1>
        <p class="page-subtitle">
          Base inicial do rebuild. Esta tela ja le metricas reais do IndexedDB, sem backend e sem sessao central.
        </p>
      </div>
      <div class="stack-sm">
        <span class="pill">{{ profileName }}</span>
        <span class="pill">Schema {{ workspace.isBootstrapped ? 'carregado' : 'inicializando' }}</span>
      </div>
    </header>

    <div class="stats-grid">
      <StatCard label="Vagas" :value="workspace.metrics.jobs" hint="Pipeline local da candidatura" />
      <StatCard label="Analises" :value="workspace.metrics.analyzed" hint="Saidas estruturadas de IA" />
      <StatCard label="Respostas" :value="workspace.metrics.answers" hint="Formularios prontos por vaga" />
      <StatCard label="CVs" :value="workspace.metrics.resumes" hint="Snapshots e PDFs gerados" />
      <StatCard label="Logs" :value="workspace.metrics.logs" hint="Rastro tecnico do workspace" />
    </div>

    <div class="grid-2">
      <SectionCard title="Ultimas vagas" subtitle="A listagem final sera a base do pipeline local.">
        <table class="table">
          <thead>
            <tr>
              <th>Titulo</th>
              <th>Status</th>
              <th>Atualizada</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="job in workspace.recentJobs" :key="job.id">
              <td>{{ job.title }}</td>
              <td>{{ job.status }}</td>
              <td>{{ formatDateTime(job.updatedAt) }}</td>
            </tr>
          </tbody>
        </table>
      </SectionCard>

      <SectionCard title="Ultimos eventos" subtitle="Tudo aqui sera local e exportavel via backup.">
        <table class="table">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Mensagem</th>
              <th>Quando</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in workspace.recentLogs" :key="log.id">
              <td>{{ log.type }}</td>
              <td>{{ log.message }}</td>
              <td>{{ formatDateTime(log.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </SectionCard>
    </div>
  </div>
</template>
