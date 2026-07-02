<script setup lang="ts">
import { onMounted, ref } from 'vue';
import SectionCard from '@/components/ui/SectionCard.vue';
import { normalizeClientErrorMessage } from '@/services/searchProviders';
import { formatDateTime } from '@/utils/date';
import {
  postedWithinOptions,
  searchProviderOptions,
  searchesStore
} from '@/stores/searches';

const store = searchesStore();
const feedback = ref('');
const feedbackTone = ref<'info' | 'success' | 'error'>('info');

onMounted(async () => {
  await store.load();
});

function newDraft() {
  store.resetDraft();
}

function editProfile(id: string) {
  store.editProfile(id);
}

async function saveDraft() {
  try {
    await store.saveDraft();
    feedback.value = 'Esquema de busca salvo localmente.';
    feedbackTone.value = 'success';
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'Falha ao salvar esquema.';
    feedbackTone.value = 'error';
  }
}

async function runProfile(id: string) {
  try {
    await store.runProfile(id);
    feedback.value = 'Busca executada com sucesso.';
    feedbackTone.value = 'success';
  } catch (error) {
    console.error('Search run error:', error);
    feedback.value = normalizeClientErrorMessage(
      error,
      'Falha ao executar busca. Revise a configuracao do provider e tente novamente.'
    );
    feedbackTone.value = 'error';
  }
}

async function removeProfile(id: string) {
  await store.removeProfile(id);
  feedback.value = 'Esquema removido do workspace local.';
  feedbackTone.value = 'info';
}
</script>

<template>
  <div class="page-stack">
    <header class="page-header">
      <div>
        <h1 class="page-title">Buscas</h1>
        <p class="page-subtitle">
          Esquemas locais com execucao manual e importacao de vagas no IndexedDB. Neste rebuild Vercel-only, as buscas sao sempre manuais e os providers suportados sao RSS e Adzuna.
        </p>
      </div>
      <button class="btn btn-secondary" type="button" @click="newDraft">Novo esquema</button>
    </header>

    <SectionCard v-if="feedback" title="Status da busca" :subtitle="feedback">
      <span class="pill" :style="{ background: feedbackTone === 'error' ? 'rgba(163, 54, 46, 0.16)' : 'rgba(31, 122, 83, 0.14)', color: feedbackTone === 'error' ? '#a3362e' : '#1f7a53' }">
        {{ feedbackTone }}
      </span>
    </SectionCard>

    <SectionCard title="Esquemas de busca" subtitle="Acoes rapidas por esquema e historico da ultima execucao.">
      <table class="table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Provider</th>
            <th>Filtros</th>
            <th>Ultima execucao</th>
            <th>Acoes</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="profile in store.profiles" :key="profile.id">
            <td>
              <strong>{{ profile.name }}</strong>
              <div class="inline-note">{{ profile.isActive ? 'ativo' : 'inativo' }}</div>
            </td>
            <td>{{ profile.provider }}</td>
            <td>
              <div class="inline-note">{{ profile.workModel ?? 'qualquer modelo' }} • {{ profile.location || 'qualquer local' }}</div>
              <div class="inline-note">{{ profile.postedWithin || 'qualquer data' }} • {{ profile.seniority || 'sem senioridade' }}</div>
            </td>
            <td>
              <div class="inline-note">{{ formatDateTime(profile.lastRanAt) }}</div>
              <div class="inline-note">{{ store.latestRunByProfile.get(profile.id)?.summary || 'Nunca executado.' }}</div>
            </td>
            <td>
              <div class="toolbar">
                <button class="btn btn-secondary" type="button" @click="editProfile(profile.id)">Editar</button>
                <button class="btn btn-primary" type="button" :disabled="store.runningProfileIds.includes(profile.id)" @click="runProfile(profile.id)">
                  {{ store.runningProfileIds.includes(profile.id) ? 'Executando...' : 'Executar' }}
                </button>
                <button class="btn btn-secondary" type="button" @click="removeProfile(profile.id)">Remover</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </SectionCard>

    <SectionCard title="Formulario do esquema" subtitle="Crie ou edite um esquema local. Keywords funcionam em OR, uma por linha ou separadas por virgula.">
      <div class="field-grid">
        <label class="field-stack">
          <span class="field-label">Nome</span>
          <input v-model="store.draft.name" class="field" placeholder="PHP remoto BR">
        </label>
        <label class="field-stack">
          <span class="field-label">Provider</span>
          <select v-model="store.draft.provider" class="field">
            <option v-for="item in searchProviderOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </label>
        <label class="field-stack">
          <span class="field-label">Localidade</span>
          <input v-model="store.draft.location" class="field" placeholder="Brasil, Portugal, Sao Paulo...">
        </label>
        <label class="field-stack">
          <span class="field-label">Senioridade</span>
          <input v-model="store.draft.seniority" class="field" placeholder="junior, mid, senior">
        </label>
        <label class="field-stack">
          <span class="field-label">Modelo</span>
          <select v-model="store.draft.workModel" class="field">
            <option :value="null">qualquer modelo</option>
            <option value="remote">remote</option>
            <option value="hybrid">hybrid</option>
            <option value="onsite">onsite</option>
          </select>
        </label>
        <label class="field-stack">
          <span class="field-label">Pais</span>
          <input v-model="store.draft.countryCode" class="field" placeholder="br">
        </label>
        <label class="field-stack">
          <span class="field-label">Publicadas</span>
          <select v-model="store.draft.postedWithin" class="field">
            <option v-for="item in postedWithinOptions" :key="item.label" :value="item.value">{{ item.label }}</option>
          </select>
        </label>
        <label class="field-stack" style="grid-column: 1 / -1;">
          <span class="field-label">Keywords</span>
          <textarea v-model="store.draft.keywords" class="textarea" placeholder="php&#10;laravel&#10;&quot;php developer&quot;"></textarea>
        </label>
        <label class="field-stack" style="grid-column: 1 / -1;">
          <span class="field-label">URL da fonte</span>
          <input v-model="store.draft.sourceUrl" class="field" placeholder="https://weworkremotely.com/remote-jobs.rss">
        </label>
        <label class="field-stack" style="grid-column: 1 / -1;">
          <span class="field-label">Observacoes</span>
          <textarea v-model="store.draft.notes" class="textarea" placeholder="Notas do esquema, limites da busca, qualidade da fonte."></textarea>
        </label>
        <label class="field-stack" style="align-content: end;">
          <span class="field-label">Esquema ativo</span>
          <input v-model="store.draft.isActive" type="checkbox">
        </label>
      </div>

      <div class="toolbar">
        <button class="btn btn-primary" type="button" @click="saveDraft">
          {{ store.draft.id ? 'Salvar alteracoes' : 'Criar esquema' }}
        </button>
        <button class="btn btn-secondary" type="button" @click="newDraft">Limpar formulario</button>
      </div>

      <p class="inline-note">
        RSS e Adzuna estao suportados no app local-first. As execucoes sao manuais por design, sem scheduler e sem automacao server-side.
      </p>
    </SectionCard>
  </div>
</template>
