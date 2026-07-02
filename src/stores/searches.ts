import { defineStore } from 'pinia';
import { db } from '@/db/schema';
import type { JobPost, SearchProfile, SearchProviderConfig, SearchRun, WorkModel } from '@/domain/entities/types';
import { assertAdzunaPayloadOk, requestAdzunaJsonp } from '@/services/searchProviders';
import { makeId } from '@/utils/ids';
import { useJobsStore } from '@/stores/jobs';
import { useWorkspaceStore } from '@/stores/workspace';

interface SearchDraft {
  id: string | null;
  name: string;
  keywords: string;
  location: string;
  workModel: WorkModel;
  seniority: string;
  provider: SearchProfile['provider'];
  sourceType: SearchProfile['sourceType'];
  countryCode: string;
  postedWithin: SearchProfile['postedWithin'];
  applicationType: SearchProfile['applicationType'];
  sourceUrl: string;
  isActive: boolean;
  notes: string;
}

interface SearchesState {
  hydrated: boolean;
  runningProfileIds: string[];
  profiles: SearchProfile[];
  runs: SearchRun[];
  draft: SearchDraft;
}

interface ParsedRssItem {
  title: string;
  company: string;
  location: string;
  description: string;
  originalUrl: string;
  publishedAt: string | null;
  workModel: WorkModel;
}

interface ParsedSearchItem {
  title: string;
  company: string;
  location: string;
  description: string;
  originalUrl: string;
  publishedAt: string | null;
  workModel: WorkModel;
  applicationType: SearchProfile['applicationType'];
  source: JobPost['source'];
}

function isSupportedSearchProvider(value: string): value is SearchProfile['provider'] {
  return value === 'rss' || value === 'adzuna';
}

function cloneSearchProfileForPersistence(profile: SearchProfile): SearchProfile {
  return {
    ...profile,
    targetDomains: [...profile.targetDomains]
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

function emptyDraft(): SearchDraft {
  return {
    id: null,
    name: '',
    keywords: '',
    location: 'Brasil',
    workModel: 'remote',
    seniority: 'senior',
    provider: 'rss',
    sourceType: 'rss',
    countryCode: 'br',
    postedWithin: '7d',
    applicationType: '',
    sourceUrl: '',
    isActive: true,
    notes: ''
  };
}

function splitKeywords(value: string): string[] {
  return value
    .split(/\n|,|;|\|/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function detectWorkModel(text: string): WorkModel {
  const normalized = normalizeText(text);

  if (/\bremote\b|\bremoto\b|\bhome office\b/.test(normalized)) {
    return 'remote';
  }

  if (/\bhybrid\b|\bhibrido\b|\bhíbrido\b/.test(normalized)) {
    return 'hybrid';
  }

  if (/\bonsite\b|\bpresencial\b|\bon site\b/.test(normalized)) {
    return 'onsite';
  }

  return null;
}

function containsAny(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => needle !== '' && haystack.includes(normalizeText(needle)));
}

function inferApplicationType(text: string): SearchProfile['applicationType'] {
  const normalized = normalizeText(text);

  if (containsAny(normalized, [
    'easy apply',
    'easily apply',
    'candidatura simplificada',
    'aplicacao simplificada',
    'quick apply',
    '1-click apply',
    'one click apply',
    'apply with one click'
  ])) {
    return 'simplified';
  }

  return '';
}

function inferCompany(title: string): { role: string; company: string } {
  const separators = [' at ', ' @ ', ' - ', ' | '];

  for (const separator of separators) {
    const index = title.toLowerCase().indexOf(separator);

    if (index > 0) {
      return {
        role: title.slice(0, index).trim(),
        company: title.slice(index + separator.length).trim()
      };
    }
  }

  return {
    role: title.trim(),
    company: ''
  };
}

function parsePubDate(value: string): string | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function matchesPostedWithin(publishedAt: string | null, postedWithin: SearchProfile['postedWithin']): boolean {
  if (!publishedAt || postedWithin === '') {
    return true;
  }

  const now = Date.now();
  const published = new Date(publishedAt).getTime();

  if (Number.isNaN(published)) {
    return true;
  }

  const limits: Record<Exclude<SearchProfile['postedWithin'], ''>, number> = {
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000
  };

  return now - published <= limits[postedWithin];
}

function matchesKeywords(item: ParsedRssItem, keywords: string[]): boolean {
  if (keywords.length === 0) {
    return true;
  }

  const haystack = normalizeText([
    item.title,
    item.company,
    item.location,
    item.description
  ].join(' '));

  return keywords.some((keyword) => haystack.includes(normalizeText(keyword.replace(/^"|"$/g, ''))));
}

function matchesLocation(item: ParsedRssItem, location: string): boolean {
  const normalizedLocation = normalizeText(location.trim());

  if (normalizedLocation === '') {
    return true;
  }

  const haystack = normalizeText([item.location, item.description].join(' '));
  return haystack.includes(normalizedLocation);
}

function matchesWorkModel(item: ParsedRssItem, workModel: WorkModel): boolean {
  if (workModel === null) {
    return true;
  }

  return item.workModel === workModel;
}

function allowsImplicitRemoteMatch(item: ParsedSearchItem, workModel: WorkModel): boolean {
  if (workModel !== 'remote') {
    return true;
  }

  const haystack = normalizeText([item.title, item.description, item.location, item.originalUrl].join(' '));

  if (haystack === '') {
    return false;
  }

  return !containsAny(haystack, [
    'hybrid',
    'hibrido',
    'híbrido',
    'modelo híbrido',
    'modelo hibrido',
    'onsite',
    'on-site',
    'presencial',
    'in office',
    'office-based',
    'no escritorio',
    'no escritório'
  ]);
}

function matchesExpectedWorkModel(item: ParsedSearchItem, workModel: WorkModel): boolean {
  if (workModel === null) {
    return true;
  }

  if (item.workModel === null) {
    return allowsImplicitRemoteMatch(item, workModel);
  }

  return item.workModel === workModel;
}

function matchesApplicationType(item: ParsedSearchItem, applicationType: SearchProfile['applicationType']): boolean {
  if (applicationType === '') {
    return true;
  }

  return item.applicationType === applicationType;
}

function matchesSeniority(item: ParsedRssItem, seniority: string): boolean {
  const normalized = normalizeText(seniority.trim());

  if (normalized === '') {
    return true;
  }

  return normalizeText([item.title, item.description].join(' ')).includes(normalized);
}

function cleanDescription(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseRssItems(xmlText: string): ParsedRssItem[] {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, 'application/xml');
  const items = [...xml.querySelectorAll('item')];

  return items.map((item) => {
    const rawTitle = item.querySelector('title')?.textContent?.trim() ?? '';
    const link = item.querySelector('link')?.textContent?.trim() ?? '';
    const description = cleanDescription(item.querySelector('description')?.textContent?.trim() ?? '');
    const pubDate = parsePubDate(item.querySelector('pubDate')?.textContent?.trim() ?? '');
    const creator = item.querySelector('creator, dc\\:creator')?.textContent?.trim() ?? '';
    const categoryText = [...item.querySelectorAll('category')]
      .map((node) => node.textContent?.trim() ?? '')
      .filter(Boolean)
      .join(' ');
    const titleParts = inferCompany(rawTitle);
    const location = item.querySelector('location')?.textContent?.trim()
      ?? item.querySelector('job\\:location')?.textContent?.trim()
      ?? '';
    const company = creator || titleParts.company;
    const workModel = detectWorkModel([rawTitle, description, categoryText, location].join(' '));

    return {
      title: titleParts.role || rawTitle,
      company,
      location,
      description,
      originalUrl: link,
      publishedAt: pubDate,
      workModel
    };
  }).filter((item) => item.title !== '' && item.originalUrl !== '');
}

async function ensureSearchProvidersSeed(): Promise<void> {
  const existing = await db.searchProviders.count();

  if (existing > 0) {
    return;
  }

  const timestamp = nowIso();

  await db.searchProviders.bulkPut([
    {
      id: makeId('search_provider'),
      createdAt: timestamp,
      updatedAt: timestamp,
      version: 1,
      provider: 'rss',
      credentialsJson: '{}',
      baseUrl: '',
      isActive: true
    },
    {
      id: makeId('search_provider'),
      createdAt: timestamp,
      updatedAt: timestamp,
      version: 1,
      provider: 'adzuna',
      credentialsJson: '{}',
      baseUrl: 'https://api.adzuna.com/v1/api/jobs',
      isActive: false
    }
  ]);
}

function parseCredentials(config: SearchProviderConfig | undefined): Record<string, string> {
  if (!config) {
    return {};
  }

  try {
    return JSON.parse(config.credentialsJson) as Record<string, string>;
  } catch {
    return {};
  }
}

function broadenKeywordAlternative(keywords: string): string {
  return keywords
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .join(' ');
}

function normalizeSearchLocation(value: string): string {
  return normalizeText(value)
    .replace('remoto global', '')
    .replace('remoto', '')
    .replace('remote global', '')
    .replace('remote', '')
    .replace(/[;,|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace('brasil', 'brazil');
}

function normalizeSearchAlternatives(value: string): string[] {
  return [...new Set(splitKeywords(value).map((item) => item.toLowerCase()).slice(0, 6))];
}

function buildAdzunaAttempts(profile: SearchProfile): Array<{ label: string; what: string; where: string }> {
  const keywordAlternatives = normalizeSearchAlternatives(profile.keywords);
  const location = normalizeSearchLocation(profile.location);
  const attempts: Array<{ label: string; what: string; where: string }> = [];

  for (const [index, keywords] of keywordAlternatives.entries()) {
    const remoteKeywords = profile.workModel === 'remote' ? `${keywords} remote`.trim() : keywords;
    const fallbackKeywords = broadenKeywordAlternative(keywords);
    const fallbackRemoteKeywords = profile.workModel === 'remote' ? `${fallbackKeywords} remote`.trim() : fallbackKeywords;

    attempts.push({ label: `primary_${index}`, what: keywords, where: location });
    attempts.push({ label: `with_remote_keyword_${index}`, what: remoteKeywords, where: location });
    attempts.push({ label: `without_location_${index}`, what: keywords, where: '' });
    attempts.push({ label: `without_location_remote_${index}`, what: remoteKeywords, where: '' });

    if (fallbackKeywords !== keywords) {
      attempts.push({ label: `broader_keywords_${index}`, what: fallbackKeywords, where: '' });
      attempts.push({ label: `broader_keywords_remote_${index}`, what: fallbackRemoteKeywords, where: '' });
    }
  }

  return attempts.filter((item) => item.what !== '').filter((item, index, array) =>
    array.findIndex((candidate) => candidate.what === item.what && candidate.where === item.where) === index
  );
}

function buildProviderSummary(
  providerLabel: string,
  unitLabel: string,
  created: number,
  duplicateCount: number,
  mismatchCount: number,
  resultsSeen: number
): string {
  if (resultsSeen === 0) {
    return `${providerLabel} processada, mas sem resultados da origem.`;
  }

  if (created === 0 && duplicateCount === 0 && mismatchCount > 0) {
    return `${providerLabel} processada. ${resultsSeen} resultado(s) visto(s), mas todos incompatíveis com os filtros selecionados.`;
  }

  if (created === 0 && duplicateCount > 0 && mismatchCount > 0) {
    return `${providerLabel} processada. 0 ${unitLabel} nova(s), ${duplicateCount} duplicada(s) e ${mismatchCount} incompatível(is) com os filtros selecionados.`;
  }

  if (created === 0 && duplicateCount > 0) {
    return `${providerLabel} processada. 0 ${unitLabel} nova(s); ${duplicateCount} resultado(s) já existia(m).`;
  }

  return `${providerLabel} processada. ${created} ${unitLabel} nova(s), ${duplicateCount} duplicada(s) e ${mismatchCount} incompatível(is) com os filtros selecionados.`;
}

async function runRssProfile(profile: SearchProfile): Promise<{ newJobs: JobPost[]; summary: string; context: Record<string, unknown> }> {
  if (profile.sourceUrl.trim() === '') {
    throw new Error('Informe a URL RSS antes de executar a busca.');
  }

  const response = await fetch(profile.sourceUrl, {
    headers: {
      Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8'
    }
  });

  if (!response.ok) {
    throw new Error(`Falha ao carregar o RSS: HTTP ${response.status}.`);
  }

  const xmlText = await response.text();
  const parsedItems = parseRssItems(xmlText);
  const keywords = splitKeywords(profile.keywords);
  const matchedItems = parsedItems.filter((item) =>
    matchesKeywords(item, keywords)
    && matchesLocation(item, profile.location)
    && matchesWorkModel(item, profile.workModel)
    && matchesSeniority(item, profile.seniority)
    && matchesPostedWithin(item.publishedAt, profile.postedWithin)
  );
  const existingUrls = new Set(
    (await db.jobs.where('searchProfileId').equals(profile.id).toArray())
      .map((item) => item.originalUrl)
      .filter(Boolean)
  );
  const timestamp = nowIso();
  const newJobs: JobPost[] = matchedItems
    .filter((item) => !existingUrls.has(item.originalUrl))
    .map((item) => ({
      id: makeId('job'),
      createdAt: timestamp,
      updatedAt: timestamp,
      version: 1,
      title: item.title,
      company: item.company,
      location: item.location || profile.location,
      workModel: item.workModel ?? profile.workModel,
      seniority: profile.seniority,
      source: 'rss',
      originalUrl: item.originalUrl,
      description: item.description,
      status: 'new',
      capturedAt: item.publishedAt ?? timestamp,
      appliedAt: null,
      notes: `Importada via esquema ${profile.name}.`,
      searchProfileId: profile.id
    }));

  return {
    newJobs,
    summary: `${matchedItems.length} vaga(s) compatíveis encontradas no RSS. ${newJobs.length} nova(s) adicionada(s).`,
    context: {
      rssUrl: profile.sourceUrl,
      parsedItems: parsedItems.length,
      matchedItems: matchedItems.length,
      insertedJobs: newJobs.length
    }
  };
}

async function runAdzunaProfile(profile: SearchProfile, config: SearchProviderConfig): Promise<{ newJobs: JobPost[]; summary: string; context: Record<string, unknown> }> {
  if (!config.isActive) {
    throw new Error('Provider Adzuna esta inativo em Configuracoes.');
  }

  const credentials = parseCredentials(config);
  const appId = credentials.app_id ?? '';
  const appKey = credentials.app_key ?? '';

  if (appId === '' || appKey === '') {
    throw new Error('Credenciais da Adzuna ausentes. Configure app_id e app_key em Configuracoes.');
  }

  const country = profile.countryCode || 'br';
  const baseUrl = (config.baseUrl || 'https://api.adzuna.com/v1/api/jobs').replace(/\/$/, '');
  const attempts = buildAdzunaAttempts(profile);
  let results: Array<Record<string, unknown>> = [];
  const attemptLog: Array<Record<string, unknown>> = [];

  for (const attempt of attempts) {
    const params = new URLSearchParams({
      app_id: appId,
      app_key: appKey,
      results_per_page: '20',
      what: attempt.what
    });

    if (attempt.where) {
      params.set('where', attempt.where);
    }

    const payload = await requestAdzunaJsonp<{ results?: Array<Record<string, unknown>> }>(`${baseUrl}/${country.toLowerCase()}/search/1?${params.toString()}`);
    assertAdzunaPayloadOk(payload);
    results = payload.results ?? [];
    attemptLog.push({
      label: attempt.label,
      what: attempt.what,
      where: attempt.where,
      results_seen: results.length
    });

    if (results.length > 0) {
      break;
    }
  }

  const existingUrls = new Set((await db.jobs.toArray()).map((item) => item.originalUrl).filter(Boolean));
  let duplicateCount = 0;
  let mismatchCount = 0;
  const newJobs: JobPost[] = [];
  const timestamp = nowIso();

  for (const result of results) {
    const title = String(result.title ?? 'Vaga importada por Adzuna').trim();
    const location = String((result.location as { display_name?: string } | undefined)?.display_name ?? profile.location).trim();
    const description = cleanDescription(String(result.description ?? result.title ?? ''));
    const originalUrl = String(result.redirect_url ?? '').trim();
    const publishedAt = parsePubDate(String(result.created ?? ''));
    const workModel = detectWorkModel([title, description, location].join(' '));
    const applicationType = inferApplicationType([title, description, originalUrl].join(' '));
    const item: ParsedSearchItem = {
      title,
      company: String((result.company as { display_name?: string } | undefined)?.display_name ?? '').trim(),
      location,
      description,
      originalUrl,
      publishedAt,
      workModel,
      applicationType,
      source: 'public_api'
    };

    if (!matchesExpectedWorkModel(item, profile.workModel)
      || !matchesApplicationType(item, profile.applicationType)
      || !matchesPostedWithin(item.publishedAt, profile.postedWithin)) {
      mismatchCount += 1;
      continue;
    }

    const uniqueUrl = item.originalUrl || `adzuna://${btoa(`${item.title}|${item.company}|${item.description}`).slice(0, 48)}`;

    if (existingUrls.has(uniqueUrl)) {
      duplicateCount += 1;
      continue;
    }

    existingUrls.add(uniqueUrl);
    newJobs.push({
      id: makeId('job'),
      createdAt: timestamp,
      updatedAt: timestamp,
      version: 1,
      title: item.title,
      company: item.company,
      location: item.location,
      workModel: item.workModel ?? profile.workModel,
      seniority: profile.seniority,
      source: 'public_api',
      originalUrl: uniqueUrl,
      description: item.description,
      status: 'new',
      capturedAt: item.publishedAt ?? timestamp,
      appliedAt: null,
      notes: 'Importada automaticamente pela API da Adzuna.',
      searchProfileId: profile.id
    });
  }

  return {
    newJobs,
    summary: buildProviderSummary('Adzuna', 'vaga(s)', newJobs.length, duplicateCount, mismatchCount, results.length),
    context: {
      collector: 'adzuna',
      attempts: attemptLog,
      results_seen: results.length,
      duplicate_count: duplicateCount,
      mismatch_count: mismatchCount,
      insertedJobs: newJobs.length
    }
  };
}
export const searchProviderOptions: Array<{ value: Extract<SearchProfile['provider'], 'rss' | 'adzuna'>; label: string }> = [
  { value: 'rss', label: 'RSS' },
  { value: 'adzuna', label: 'Adzuna API' }
];

export const postedWithinOptions: Array<{ value: SearchProfile['postedWithin']; label: string }> = [
  { value: '', label: 'qualquer data' },
  { value: '24h', label: 'ultimas 24h' },
  { value: '7d', label: 'ultima semana' },
  { value: '30d', label: 'ultimos 30 dias' }
];

export const searchesStore = defineStore('searches', {
  state: (): SearchesState => ({
    hydrated: false,
    runningProfileIds: [],
    profiles: [],
    runs: [],
    draft: emptyDraft()
  }),

  getters: {
    latestRunByProfile(state) {
      const map = new Map<string, SearchRun>();

      for (const run of state.runs) {
        const current = map.get(run.searchProfileId);

        if (!current || run.updatedAt > current.updatedAt) {
          map.set(run.searchProfileId, run);
        }
      }

      return map;
    }
  },

  actions: {
    async load() {
      await ensureSearchProvidersSeed();
      const [profiles, runs] = await Promise.all([
        db.searchProfiles.orderBy('updatedAt').reverse().toArray(),
        db.searchRuns.orderBy('startedAt').reverse().toArray()
      ]);

      this.profiles = profiles.filter((profile) => isSupportedSearchProvider(String(profile.provider)));
      this.runs = runs;
      this.hydrated = true;
    },

    resetDraft() {
      this.draft = emptyDraft();
    },

    editProfile(profileId: string) {
      const profile = this.profiles.find((item) => item.id === profileId);

      if (!profile) {
        return;
      }

      this.draft = {
        id: profile.id,
        name: profile.name,
        keywords: profile.keywords,
        location: profile.location,
        workModel: profile.workModel,
        seniority: profile.seniority,
        provider: profile.provider,
        sourceType: profile.sourceType,
        countryCode: profile.countryCode,
        postedWithin: profile.postedWithin,
        applicationType: profile.applicationType,
        sourceUrl: profile.sourceUrl,
        isActive: profile.isActive,
        notes: profile.notes
      };
    },

    async saveDraft() {
      const timestamp = nowIso();
      const existing = this.draft.id
        ? this.profiles.find((item) => item.id === this.draft.id) ?? null
        : null;

      const profile: SearchProfile = {
        id: existing?.id ?? makeId('search'),
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
        version: existing ? existing.version + 1 : 1,
        name: this.draft.name.trim() || 'Novo esquema de busca',
        keywords: this.draft.keywords.trim(),
        location: this.draft.location.trim(),
        workModel: this.draft.workModel,
        seniority: this.draft.seniority.trim(),
        provider: this.draft.provider,
        sourceType: this.draft.provider === 'rss' ? 'rss' : 'api',
        countryCode: this.draft.countryCode.trim().toLowerCase() || 'br',
        postedWithin: this.draft.postedWithin,
        applicationType: this.draft.applicationType,
        sourceUrl: this.draft.sourceUrl.trim(),
        targetDomains: [],
        frequency: 'manual',
        isActive: this.draft.isActive,
        notes: this.draft.notes.trim(),
        lastRanAt: existing?.lastRanAt ?? null
      };

      await db.searchProfiles.put(profile);
      await db.logs.put({
        id: makeId('log'),
        createdAt: timestamp,
        updatedAt: timestamp,
        version: 1,
        type: 'job_import',
        status: 'info',
        message: `Esquema de busca ${existing ? 'atualizado' : 'criado'}: ${profile.name}.`,
        contextJson: JSON.stringify({ searchProfileId: profile.id, provider: profile.provider })
      });

      await this.load();
      await useWorkspaceStore().bootstrap();
      this.resetDraft();
    },

    async removeProfile(profileId: string) {
      await db.searchProfiles.delete(profileId);
      await db.searchRuns.where('searchProfileId').equals(profileId).delete();
      await db.logs.put({
        id: makeId('log'),
        createdAt: nowIso(),
        updatedAt: nowIso(),
        version: 1,
        type: 'job_import',
        status: 'warning',
        message: 'Esquema de busca removido do workspace local.',
        contextJson: JSON.stringify({ searchProfileId: profileId })
      });

      await this.load();
      await useWorkspaceStore().bootstrap();

      if (this.draft.id === profileId) {
        this.resetDraft();
      }
    },

    async runProfile(profileId: string) {
      const profile = this.profiles.find((item) => item.id === profileId);

      if (!profile) {
        throw new Error('Esquema de busca nao encontrado.');
      }

      if (this.runningProfileIds.includes(profileId)) {
        return;
      }

      this.runningProfileIds = [...this.runningProfileIds, profileId];
      const startedAt = nowIso();
      const runId = makeId('search_run');

      await db.searchRuns.put({
        id: runId,
        createdAt: startedAt,
        updatedAt: startedAt,
        version: 1,
        searchProfileId: profile.id,
        status: 'running',
        summary: 'Execucao iniciada.',
        foundCount: 0,
        startedAt,
        finishedAt: null,
        contextJson: JSON.stringify({ provider: profile.provider })
      });

      try {
        const [rssConfig, adzunaConfig] = await Promise.all([
          db.searchProviders.where('provider').equals('rss').first(),
          db.searchProviders.where('provider').equals('adzuna').first()
        ]);
        const timestamp = nowIso();
        const execution = profile.provider === 'rss'
          ? await runRssProfile(profile)
          : await runAdzunaProfile(profile, adzunaConfig ?? {
            id: '',
            createdAt: timestamp,
            updatedAt: timestamp,
            version: 1,
            provider: 'adzuna',
            credentialsJson: '{}',
            baseUrl: 'https://api.adzuna.com/v1/api/jobs',
            isActive: false
          });

        profile.lastRanAt = timestamp;
        profile.updatedAt = timestamp;
        profile.version += 1;
        const persistedProfile = cloneSearchProfileForPersistence(profile);

        await db.transaction('rw', db.searchProfiles, db.searchRuns, db.jobs, db.logs, async () => {
          await db.searchProfiles.put(persistedProfile);

          if (execution.newJobs.length > 0) {
            await db.jobs.bulkPut(execution.newJobs);
          }

          await db.searchRuns.put({
            id: runId,
            createdAt: startedAt,
            updatedAt: timestamp,
            version: 2,
            searchProfileId: profile.id,
            status: 'completed',
            summary: execution.summary,
            foundCount: execution.newJobs.length,
            startedAt,
            finishedAt: timestamp,
            contextJson: JSON.stringify(execution.context)
          });

          await db.logs.put({
            id: makeId('log'),
            createdAt: timestamp,
            updatedAt: timestamp,
            version: 1,
            type: 'job_import',
            status: 'success',
            message: `Busca ${profile.provider.toUpperCase()} concluida: ${execution.summary}`,
            contextJson: JSON.stringify({ searchProfileId: profile.id, runId, ...execution.context })
          });
        });

        await Promise.all([
          this.load(),
          useJobsStore().load(),
          useWorkspaceStore().bootstrap()
        ]);
      } catch (error) {
        const timestamp = nowIso();
        const message = error instanceof Error ? error.message : 'Falha ao executar busca local.';

        await db.transaction('rw', db.searchRuns, db.logs, async () => {
          await db.searchRuns.put({
            id: runId,
            createdAt: startedAt,
            updatedAt: timestamp,
            version: 2,
            searchProfileId: profile.id,
            status: 'failed',
            summary: message,
            foundCount: 0,
            startedAt,
            finishedAt: timestamp,
            contextJson: JSON.stringify({ searchProfileId: profile.id })
          });

          await db.logs.put({
            id: makeId('log'),
            createdAt: timestamp,
            updatedAt: timestamp,
            version: 1,
            type: 'error',
            status: 'error',
            message: `Falha na busca local: ${message}`,
            contextJson: JSON.stringify({ searchProfileId: profile.id, runId })
          });
        });

        await this.load();
        await useWorkspaceStore().bootstrap();
        throw error;
      } finally {
        this.runningProfileIds = this.runningProfileIds.filter((item) => item !== profileId);
      }
    }
  }
});
