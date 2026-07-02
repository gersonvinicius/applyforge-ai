import { defineStore } from 'pinia';
import { db } from '@/db/schema';
import type { SearchProviderConfig } from '@/domain/entities/types';
import { assertAdzunaPayloadOk, requestAdzunaJsonp } from '@/services/searchProviders';
import { makeId } from '@/utils/ids';
import { useWorkspaceStore } from '@/stores/workspace';

interface SearchProviderDraft {
  id: string | null;
  provider: SearchProviderConfig['provider'];
  credentials: {
    app_id?: string;
    app_key?: string;
    api_key?: string;
  };
  baseUrl: string;
  isActive: boolean;
}

interface SearchProvidersState {
  hydrated: boolean;
  isSaving: boolean;
  isTesting: boolean;
  providers: SearchProviderConfig[];
  drafts: Record<SearchProviderConfig['provider'], SearchProviderDraft>;
}

function isSupportedSearchProvider(value: string): value is SearchProviderConfig['provider'] {
  return value === 'rss' || value === 'adzuna';
}

function nowIso(): string {
  return new Date().toISOString();
}

function safeParseCredentials(value: string): Record<string, string> {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;

    return Object.fromEntries(
      Object.entries(parsed)
        .map(([key, item]) => [key, String(item ?? '').trim()])
        .filter(([, item]) => item !== '')
    );
  } catch {
    return {};
  }
}

function buildDefaultProvider(provider: SearchProviderConfig['provider']): SearchProviderConfig {
  const timestamp = nowIso();

  return {
    id: makeId('search_provider'),
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
    provider,
    credentialsJson: '{}',
    baseUrl: provider === 'adzuna' ? 'https://api.adzuna.com/v1/api/jobs' : '',
    isActive: provider === 'rss'
  };
}

function toDraft(config: SearchProviderConfig): SearchProviderDraft {
  const credentials = safeParseCredentials(config.credentialsJson);

  return {
    id: config.id,
    provider: config.provider,
    credentials: {
      app_id: credentials.app_id ?? '',
      app_key: credentials.app_key ?? '',
      api_key: credentials.api_key ?? ''
    },
    baseUrl: config.baseUrl,
    isActive: config.isActive
  };
}

export const searchProviderDefinitions: Record<SearchProviderConfig['provider'], {
  label: string;
  description: string;
  requiresCredentials: boolean;
  fields: Array<{ key: 'app_id' | 'app_key' | 'api_key'; label: string; sensitive: boolean }>;
}> = {
  rss: {
    label: 'RSS / Atom',
    description: 'Feeds publicos nao precisam de chave. Basta informar a URL do feed no esquema.',
    requiresCredentials: false,
    fields: []
  },
  adzuna: {
    label: 'Adzuna API',
    description: 'Busca estruturada via Adzuna. Requer app_id e app_key do portal do desenvolvedor.',
    requiresCredentials: true,
    fields: [
      { key: 'app_id', label: 'App ID', sensitive: true },
      { key: 'app_key', label: 'App Key', sensitive: true }
    ]
  }
};

export const useSearchProvidersStore = defineStore('searchProviders', {
  state: (): SearchProvidersState => ({
    hydrated: false,
    isSaving: false,
    isTesting: false,
    providers: [],
    drafts: {
      rss: toDraft(buildDefaultProvider('rss')),
      adzuna: toDraft(buildDefaultProvider('adzuna'))
    }
  }),

  getters: {
    maskedCredentials: (state) => (provider: SearchProviderConfig['provider']) => {
      const draft = state.drafts[provider];

      return Object.fromEntries(
        Object.entries(draft.credentials).map(([key, value]) => {
          if (!value) {
            return [key, 'nao configurada'];
          }

          return [key, value.length <= 8 ? '********' : `${value.slice(0, 4)}...${value.slice(-4)}`];
        })
      );
    }
  },

  actions: {
    async ensureDefaults() {
      for (const provider of ['rss', 'adzuna'] as const) {
        const existing = await db.searchProviders.where('provider').equals(provider).first();

        if (!existing) {
          await db.searchProviders.put(buildDefaultProvider(provider));
        }
      }
    },

    async load() {
      await this.ensureDefaults();
      const providers = await db.searchProviders.toArray();
      this.providers = providers.filter((provider) => isSupportedSearchProvider(String(provider.provider)));

      for (const provider of this.providers) {
        this.drafts[provider.provider] = toDraft(provider);
      }

      this.hydrated = true;
    },

    async save(providerKey: SearchProviderConfig['provider']) {
      if (!this.hydrated) {
        await this.load();
      }

      const draft = this.drafts[providerKey];
      const existing = this.providers.find((item) => item.provider === providerKey) ?? buildDefaultProvider(providerKey);
      const timestamp = nowIso();
      const credentials = Object.fromEntries(
        Object.entries(draft.credentials)
          .map(([key, value]) => [key, String(value ?? '').trim()])
          .filter(([, value]) => value !== '')
      );

      const payload: SearchProviderConfig = {
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: timestamp,
        version: existing.version + (existing.id ? 1 : 0),
        provider: providerKey,
        credentialsJson: JSON.stringify(credentials),
        baseUrl: draft.baseUrl.trim(),
        isActive: draft.isActive
      };

      this.isSaving = true;

      try {
        await db.searchProviders.put(payload);
        await db.logs.put({
          id: makeId('log'),
          createdAt: timestamp,
          updatedAt: timestamp,
          version: 1,
          type: 'token_cost',
          status: 'info',
          message: `Configuracoes locais do provider de busca ${providerKey} atualizadas.`,
          contextJson: JSON.stringify({
            provider: providerKey,
            hasCredentials: Object.keys(credentials).length > 0,
            isActive: payload.isActive
          })
        });

        await this.load();
        await useWorkspaceStore().bootstrap();
      } finally {
        this.isSaving = false;
      }
    },

    async testConnection(providerKey: 'adzuna') {
      if (!this.hydrated) {
        await this.load();
      }

      const draft = this.drafts[providerKey];

      if (!draft.isActive) {
        throw new Error('Ative o provider antes de testar.');
      }

      this.isTesting = true;

      try {
        const timestamp = nowIso();
        const appId = String(draft.credentials.app_id ?? '').trim();
        const appKey = String(draft.credentials.app_key ?? '').trim();

        if (appId === '' || appKey === '') {
          throw new Error('Configure app_id e app_key antes de testar este provider.');
        }

        const baseUrl = (draft.baseUrl || 'https://api.adzuna.com/v1/api/jobs').replace(/\/$/, '');
        const params = new URLSearchParams({
          app_id: appId,
          app_key: appKey,
          results_per_page: '1',
          what: 'developer'
        });
        const payload = await requestAdzunaJsonp<{ count?: number; results?: unknown[] }>(`${baseUrl}/br/search/1?${params.toString()}`);
        assertAdzunaPayloadOk(payload);
        const result: Record<string, unknown> = {
          provider: 'adzuna',
          ok: true,
          baseUrl,
          totalResults: Number(payload.count ?? 0),
          sampleCount: Array.isArray(payload.results) ? payload.results.length : 0
        };

        await db.logs.put({
          id: makeId('log'),
          createdAt: timestamp,
          updatedAt: timestamp,
          version: 1,
          type: 'token_cost',
          status: 'success',
          message: `Teste de conexao do provider de busca ${providerKey} concluido com sucesso.`,
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
