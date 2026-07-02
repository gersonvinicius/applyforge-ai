<script setup lang="ts">
import { onMounted, ref } from 'vue';
import SectionCard from '@/components/ui/SectionCard.vue';
import { normalizeClientErrorMessage } from '@/services/searchProviders';
import { useWorkspaceStore } from '@/stores/workspace';
import type { WorkspaceSnapshot } from '@/domain/entities/types';
import { openRouterModelOptions, useAiProvidersStore } from '@/stores/aiProviders';
import { searchProviderDefinitions, useSearchProvidersStore } from '@/stores/searchProviders';

const workspace = useWorkspaceStore();
const aiProviders = useAiProvidersStore();
const searchProviders = useSearchProvidersStore();
const fileInput = ref<HTMLInputElement | null>(null);
const showAiApiKey = ref(false);
const showSearchSecrets = ref<Record<string, boolean>>({});
const feedback = ref('');
const feedbackTone = ref<'info' | 'success' | 'error'>('info');
const visibleSearchProviders = ['rss', 'adzuna'] as const;

onMounted(async () => {
  await aiProviders.load();
  await searchProviders.load();
});

async function exportBackup() {
  const snapshot = await workspace.exportSnapshot();
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `applyforge-workspace-${Date.now()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function triggerImport() {
  fileInput.value?.click();
}

async function handleImport(event: Event) {
  const target = event.target as HTMLInputElement | null;
  const file = target?.files?.[0];

  if (! file) {
    return;
  }

  try {
    const raw = await file.text();
    const snapshot = JSON.parse(raw) as WorkspaceSnapshot;

    await workspace.importSnapshot(snapshot);
    feedback.value = `Backup importado: ${file.name}`;
    feedbackTone.value = 'success';
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'Falha ao importar backup.';
    feedbackTone.value = 'error';
  } finally {
    if (target) {
      target.value = '';
    }
  }
}

async function clearWorkspace() {
  await workspace.wipeWorkspace();
  await workspace.seedLocalWorkspace();
  feedback.value = 'Workspace resetado para o seed inicial do scaffold.';
  feedbackTone.value = 'info';
}

async function saveAiProvider() {
  await aiProviders.save();
  feedback.value = 'Provider local de IA salvo neste dispositivo.';
  feedbackTone.value = 'success';
}

async function testAiProvider() {
  try {
    const result = await aiProviders.testConnection();
    feedback.value = `Conexao OK com ${result.provider} usando ${result.model}. Resposta: ${result.contentPreview}`;
    feedbackTone.value = 'success';
  } catch (error) {
    feedback.value = error instanceof Error ? error.message : 'Falha ao testar o provider de IA.';
    feedbackTone.value = 'error';
  }
}

async function saveSearchProvider(provider: 'rss' | 'adzuna') {
  await searchProviders.save(provider);
  feedback.value = `Provider de busca ${provider} salvo neste dispositivo.`;
  feedbackTone.value = 'success';
}

function searchSecretKey(provider: 'rss' | 'adzuna', field: 'app_id' | 'app_key' | 'api_key'): string {
  return `${provider}:${field}`;
}

function isSearchSecretVisible(provider: 'rss' | 'adzuna', field: 'app_id' | 'app_key' | 'api_key'): boolean {
  return showSearchSecrets.value[searchSecretKey(provider, field)] ?? false;
}

function toggleSearchSecret(provider: 'rss' | 'adzuna', field: 'app_id' | 'app_key' | 'api_key') {
  const key = searchSecretKey(provider, field);
  showSearchSecrets.value[key] = !isSearchSecretVisible(provider, field);
}

function canTestSearchProvider(provider: 'adzuna'): boolean {
  return searchProviders.drafts[provider].isActive;
}

async function testSearchProvider(provider: 'adzuna') {
  try {
    const result = await searchProviders.testConnection(provider);
    const details = `${result.totalResults} resultado(s) totais na API, ${result.sampleCount} item(ns) retornado(s) no teste`;

    feedback.value = `Conexao OK com ${provider}. ${details}.`;
    feedbackTone.value = 'success';
  } catch (error) {
    console.error('Adzuna test provider error:', error);
    feedback.value = normalizeClientErrorMessage(
      error,
      `Falha ao testar o provider ${provider}. Revise app_id/app_key e tente novamente sem extensoes de bloqueio.`
    );
    feedbackTone.value = 'error';
  }
}
</script>

<template>
  <div class="page-stack">
    <header class="page-header">
      <div>
        <h1 class="page-title">Configuracoes locais</h1>
        <p class="page-subtitle">
          Neste rebuild, chaves de IA e busca ficam no navegador do usuario. Nada sera salvo em backend proprio.
        </p>
      </div>
      <div style="display: flex; gap: 12px; flex-wrap: wrap;">
        <button class="btn btn-primary" type="button" @click="exportBackup">Exportar backup</button>
        <button class="btn btn-secondary" type="button" @click="triggerImport">Importar backup</button>
        <button class="btn btn-secondary" type="button" @click="clearWorkspace">Resetar workspace</button>
        <input
          ref="fileInput"
          type="file"
          accept="application/json"
          style="display: none;"
          @change="handleImport"
        >
      </div>
    </header>

    <SectionCard
      v-if="feedback"
      title="Status do workspace"
      :subtitle="feedback"
    >
      <span class="pill" :style="{ background: feedbackTone === 'error' ? 'rgba(163, 54, 46, 0.16)' : 'rgba(31, 122, 83, 0.14)', color: feedbackTone === 'error' ? '#a3362e' : '#1f7a53' }">
        {{ feedbackTone }}
      </span>
    </SectionCard>

    <div class="grid-2">
      <SectionCard title="Provider de IA local" subtitle="Chave e modelo ficam no navegador do usuario. Nao existe storage server-side neste rebuild.">
        <div v-if="aiProviders.provider" class="stack-md">
          <div class="field-grid">
            <label class="field-stack">
              <span class="field-label">Provider</span>
              <input :value="aiProviders.provider.provider" class="field" readonly>
            </label>
            <label class="field-stack">
              <span class="field-label">Base URL</span>
              <input v-model="aiProviders.provider.baseUrl" class="field" placeholder="https://openrouter.ai/api/v1">
            </label>
            <label class="field-stack">
              <span class="field-label">Modelo padrao</span>
              <select v-model="aiProviders.provider.defaultModel" class="field">
                <option v-for="item in openRouterModelOptions" :key="item" :value="item">{{ item }}</option>
              </select>
            </label>
            <label class="field-stack">
              <span class="field-label">API key</span>
              <div class="toolbar">
                <input
                  v-model="aiProviders.provider.apiKey"
                  class="field"
                  :type="showAiApiKey ? 'text' : 'password'"
                  placeholder="sk-or-v1-..."
                  style="flex: 1 1 260px;"
                >
                <button class="btn btn-secondary" type="button" @click="showAiApiKey = !showAiApiKey">
                  {{ showAiApiKey ? 'Ocultar' : 'Mostrar' }}
                </button>
              </div>
            </label>
            <label class="field-stack">
              <span class="field-label">Temperatura</span>
              <input v-model.number="aiProviders.provider.temperature" class="field" type="number" min="0" max="2" step="0.1">
            </label>
            <label class="field-stack">
              <span class="field-label">Max tokens</span>
              <input v-model.number="aiProviders.provider.maxTokens" class="field" type="number" min="1" step="100">
            </label>
            <label class="field-stack" style="align-content: end;">
              <span class="field-label">Ativo</span>
              <input v-model="aiProviders.provider.isActive" type="checkbox">
            </label>
          </div>

          <div class="toolbar">
            <span class="pill">{{ aiProviders.hasApiKey ? 'api key configurada' : 'api key ausente' }}</span>
            <span class="inline-note">chave mascarada: {{ aiProviders.maskedApiKey }}</span>
          </div>

          <div class="toolbar">
            <button class="btn btn-primary" type="button" @click="saveAiProvider">Salvar provider</button>
            <button class="btn btn-secondary" type="button" :disabled="aiProviders.isTesting" @click="testAiProvider">
              {{ aiProviders.isTesting ? 'Testando...' : 'Testar conexao' }}
            </button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Providers de busca locais" subtitle="Cada usuario configura suas proprias chaves de busca no navegador.">
        <div class="stack-md">
          <article v-for="providerKey in visibleSearchProviders" :key="providerKey" class="entry-card">
            <div class="stack-sm">
              <div>
                <h3 class="card-title" style="margin-bottom: 6px;">{{ searchProviderDefinitions[providerKey].label }}</h3>
                <p class="inline-note">{{ searchProviderDefinitions[providerKey].description }}</p>
              </div>

              <div class="field-grid">
                <label class="field-stack">
                  <span class="field-label">Base URL</span>
                  <input v-model="searchProviders.drafts[providerKey].baseUrl" class="field" placeholder="https://...">
                </label>
                <label class="field-stack" style="align-content: end;">
                  <span class="field-label">Ativo</span>
                  <input v-model="searchProviders.drafts[providerKey].isActive" type="checkbox">
                </label>
                <label
                  v-for="field in searchProviderDefinitions[providerKey].fields"
                  :key="field.key"
                  class="field-stack"
                >
                  <span class="field-label">{{ field.label }}</span>
                  <div class="toolbar">
                    <input
                      v-model="searchProviders.drafts[providerKey].credentials[field.key]"
                      class="field"
                      :type="field.sensitive && !isSearchSecretVisible(providerKey, field.key) ? 'password' : 'text'"
                      :placeholder="field.label"
                      style="flex: 1 1 220px;"
                    >
                    <button
                      v-if="field.sensitive"
                      class="btn btn-secondary"
                      type="button"
                      @click="toggleSearchSecret(providerKey, field.key)"
                    >
                      {{ isSearchSecretVisible(providerKey, field.key) ? 'Ocultar' : 'Mostrar' }}
                    </button>
                  </div>
                </label>
              </div>

              <div class="toolbar">
                <span class="pill">
                  {{ searchProviderDefinitions[providerKey].requiresCredentials ? 'credenciais locais' : 'sem credenciais' }}
                </span>
                <span v-if="providerKey !== 'rss'" class="pill" :style="{ background: searchProviders.drafts[providerKey].isActive ? 'rgba(31, 122, 83, 0.14)' : 'rgba(163, 54, 46, 0.16)', color: searchProviders.drafts[providerKey].isActive ? '#1f7a53' : '#a3362e' }">
                  {{ searchProviders.drafts[providerKey].isActive ? 'ativo' : 'inativo' }}
                </span>
                <span v-if="providerKey !== 'rss'" class="inline-note">
                  mascarado:
                  {{
                    providerKey === 'adzuna'
                      ? `${searchProviders.maskedCredentials(providerKey).app_id} / ${searchProviders.maskedCredentials(providerKey).app_key}`
                      : searchProviders.maskedCredentials(providerKey).api_key
                  }}
                </span>
              </div>

              <p v-if="providerKey !== 'rss' && !searchProviders.drafts[providerKey].isActive" class="inline-note" style="color: #a3362e;">
                Ative este provider antes de testar conexao ou usar buscas com ele.
              </p>

              <div class="toolbar">
                <button class="btn btn-primary" type="button" :disabled="searchProviders.isSaving" @click="saveSearchProvider(providerKey)">
                  {{ searchProviders.isSaving ? 'Salvando...' : 'Salvar provider' }}
                </button>
                <button
                  v-if="providerKey !== 'rss'"
                  class="btn btn-secondary"
                  type="button"
                  :disabled="searchProviders.isTesting || !canTestSearchProvider(providerKey)"
                  @click="testSearchProvider(providerKey)"
                >
                  {{
                    !canTestSearchProvider(providerKey)
                      ? 'Ative para testar'
                      : searchProviders.isTesting
                        ? 'Testando...'
                        : 'Testar provider'
                  }}
                </button>
              </div>
            </div>
          </article>
        </div>
      </SectionCard>

      <SectionCard title="Politica de dados" subtitle="Ponto central da arquitetura local-first.">
        <ul class="stack-sm" style="padding-left: 18px; margin: 0;">
          <li>Sem login e sem conta central no MVP.</li>
          <li>Tokens e configuracoes ficam apenas neste dispositivo.</li>
          <li>Backup e restore serao responsabilidade explicita do usuario.</li>
          <li>PDFs gerados poderao ter politica de retencao para nao pesar o navegador.</li>
        </ul>
      </SectionCard>

      <SectionCard title="Backlog tecnico" subtitle="Itens ja esperados para a Sprint 1 e Sprint 2.">
        <ul class="stack-sm" style="padding-left: 18px; margin: 0;">
          <li>Forms tipados com Zod.</li>
          <li>Store de providers locais.</li>
          <li>Import do LinkedIn PDF em worker.</li>
          <li>Persistencia de blobs via IndexedDB ou OPFS.</li>
        </ul>
      </SectionCard>
    </div>
  </div>
</template>
