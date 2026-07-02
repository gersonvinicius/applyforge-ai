import { defineStore } from 'pinia';
import { db } from '@/db/schema';
import type { AiProviderConfig } from '@/domain/entities/types';
import { testOpenRouterConnection } from '@/services/openRouter';
import { makeId } from '@/utils/ids';
import { useWorkspaceStore } from '@/stores/workspace';

interface AiProvidersState {
  hydrated: boolean;
  isSaving: boolean;
  isTesting: boolean;
  provider: AiProviderConfig | null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function defaultProvider(): AiProviderConfig {
  const timestamp = nowIso();

  return {
    id: makeId('ai'),
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
    provider: 'openrouter',
    apiKey: '',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'deepseek/deepseek-v4-flash',
    temperature: 0.2,
    maxTokens: 2400,
    isActive: true
  };
}

export const openRouterModelOptions = [
  'deepseek/deepseek-v4-flash',
  'openai/gpt-4.1-mini',
  'anthropic/claude-3.7-sonnet',
  'google/gemini-2.5-flash',
  'meta-llama/llama-4-maverick'
];

export const useAiProvidersStore = defineStore('aiProviders', {
  state: (): AiProvidersState => ({
    hydrated: false,
    isSaving: false,
    isTesting: false,
    provider: null
  }),

  getters: {
    hasApiKey(state): boolean {
      return (state.provider?.apiKey ?? '').trim().length > 0;
    },

    maskedApiKey(state): string {
      const apiKey = state.provider?.apiKey ?? '';

      if (apiKey.length <= 8) {
        return apiKey ? '********' : 'nao configurada';
      }

      return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
    }
  },

  actions: {
    async load() {
      const provider = await db.aiProviders.toCollection().first();

      if (! provider) {
        const seeded = defaultProvider();
        await db.aiProviders.put(seeded);
        this.provider = seeded;
      } else {
        this.provider = provider;
      }

      this.hydrated = true;
    },

    async save() {
      if (! this.provider) {
        await this.load();
      }

      if (! this.provider) {
        return;
      }

      this.isSaving = true;

      try {
        this.provider.updatedAt = nowIso();
        this.provider.version += 1;
        await db.aiProviders.put({ ...this.provider });
        await db.logs.put({
          id: makeId('log'),
          createdAt: this.provider.updatedAt,
          updatedAt: this.provider.updatedAt,
          version: 1,
          type: 'token_cost',
          status: 'info',
          message: 'Configuracoes locais do provider de IA atualizadas.',
          contextJson: JSON.stringify({
            provider: this.provider.provider,
            model: this.provider.defaultModel,
            hasApiKey: this.provider.apiKey.trim().length > 0
          })
        });
        const workspace = useWorkspaceStore();
        await workspace.bootstrap();
      } finally {
        this.isSaving = false;
      }
    },

    async testConnection() {
      if (!this.provider) {
        await this.load();
      }

      if (!this.provider) {
        throw new Error('Provider local de IA nao carregado.');
      }

      if (!this.provider.isActive) {
        throw new Error('Ative o provider antes de testar a conexao.');
      }

      if (this.provider.apiKey.trim() === '') {
        throw new Error('Informe a API key antes de testar a conexao.');
      }

      this.isTesting = true;

      try {
        const result = await testOpenRouterConnection(this.provider);
        const timestamp = nowIso();

        await db.logs.put({
          id: makeId('log'),
          createdAt: timestamp,
          updatedAt: timestamp,
          version: 1,
          type: 'token_cost',
          status: 'success',
          message: 'Teste de conexao do provider de IA concluido com sucesso.',
          contextJson: JSON.stringify(result)
        });

        await useWorkspaceStore().bootstrap();

        return result;
      } finally {
        this.isTesting = false;
      }
    }
  }
});
