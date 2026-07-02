import { defineStore } from 'pinia';
import { db } from '@/db/schema';
import type { Education, Experience, JobAnalysis, JobPost, Profile, Skill } from '@/domain/entities/types';
import { makeId } from '@/utils/ids';
import { renderAnalyzeJobPrompt } from '@/prompts/analyzeJobPrompt';
import { runOpenRouterJsonPrompt } from '@/services/openRouter';
import { useAiProvidersStore } from '@/stores/aiProviders';
import { useJobsStore } from '@/stores/jobs';
import { useWorkspaceStore } from '@/stores/workspace';

interface AnalysesState {
  hydrated: boolean;
  runningJobIds: string[];
  analyses: JobAnalysis[];
}

interface ParsedAnalysisPayload {
  job_title?: string;
  company?: string;
  seniority?: string;
  work_model?: string;
  required_skills?: string[];
  desired_skills?: string[];
  responsibilities?: string[];
  keywords?: string[];
  risks?: string[];
  fit_score?: number;
  fit_level?: string;
  fit_summary?: string;
  missing_requirements?: string[];
  suggested_positioning?: string;
  recommended_resume_title?: string;
  recommended_file_name?: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : [];
}

function normalizeFitLabel(value: unknown, score: number | null): string {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (['strong', 'medium', 'low', 'aggressive'].includes(normalized)) {
    return normalized;
  }

  if (score === null) {
    return 'medium';
  }

  if (score >= 80) {
    return 'strong';
  }

  if (score >= 60) {
    return 'medium';
  }

  if (score >= 40) {
    return 'low';
  }

  return 'aggressive';
}

function safeJsonParse(raw: string): ParsedAnalysisPayload {
  const parsed = JSON.parse(raw) as ParsedAnalysisPayload;

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Analise retornou JSON invalido.');
  }

  return parsed;
}

function profilePayload(
  profile: Profile,
  experiences: Experience[],
  educations: Education[],
  skills: Skill[]
) {
  return {
    ...profile,
    experiences,
    educations,
    skills
  };
}

export const useAnalysesStore = defineStore('analyses', {
  state: (): AnalysesState => ({
    hydrated: false,
    runningJobIds: [],
    analyses: []
  }),

  getters: {
    latestByJobId(state) {
      const map = new Map<string, JobAnalysis>();

      for (const analysis of state.analyses) {
        const current = map.get(analysis.jobPostId);

        if (!current || analysis.updatedAt > current.updatedAt) {
          map.set(analysis.jobPostId, analysis);
        }
      }

      return map;
    }
  },

  actions: {
    async load() {
      this.analyses = await db.analyses.orderBy('updatedAt').reverse().toArray();
      this.hydrated = true;
    },

    async analyzeJob(job: JobPost) {
      if (this.runningJobIds.includes(job.id)) {
        return;
      }

      const providerStore = useAiProvidersStore();

      if (!providerStore.hydrated) {
        await providerStore.load();
      }

      const provider = providerStore.provider;

      if (!provider || !provider.isActive) {
        throw new Error('Provider de IA local esta inativo.');
      }

      if (provider.apiKey.trim() === '') {
        throw new Error('Configure a API key do OpenRouter antes de analisar vagas.');
      }

      const [profile, experiences, educations, skills] = await Promise.all([
        db.profile.toCollection().first().then((value) => value ?? null),
        db.experiences.orderBy('sortOrder').toArray(),
        db.educations.toArray(),
        db.skills.toArray()
      ]);

      if (!profile) {
        throw new Error('Preencha o perfil base antes de analisar vagas.');
      }

      if (job.description.trim() === '' && job.title.trim() === '') {
        throw new Error('A vaga precisa de titulo ou descricao para ser analisada.');
      }

      this.runningJobIds = [...this.runningJobIds, job.id];

      try {
        const linkedinAsset = profile.linkedinResumeAssetId
          ? await db.assets.get(profile.linkedinResumeAssetId)
          : null;
        const linkedinImport = linkedinAsset
          ? await import('@/services/linkedinResumeImport')
          : null;
        const linkedinResumeText = linkedinAsset
          ? (await linkedinImport!.extractLinkedInResumeImport(linkedinAsset)).rawText
          : 'N/A';
        const prompt = renderAnalyzeJobPrompt({
          profileJson: profilePayload(profile, experiences, educations, skills),
          linkedinResumeText,
          jobJson: job
        });

        const response = await runOpenRouterJsonPrompt(provider, prompt);
        const payload = safeJsonParse(response.content);
        const timestamp = nowIso();
        const fitScore = typeof payload.fit_score === 'number' ? payload.fit_score : null;

        const analysis: JobAnalysis = {
          id: makeId('analysis'),
          createdAt: timestamp,
          updatedAt: timestamp,
          version: 1,
          jobPostId: job.id,
          provider: provider.provider,
          model: provider.defaultModel,
          fitScore,
          fitLabel: normalizeFitLabel(payload.fit_level, fitScore),
          fitSummary: String(payload.fit_summary ?? '').trim(),
          requiredSkills: toStringArray(payload.required_skills),
          desiredSkills: toStringArray(payload.desired_skills),
          responsibilities: toStringArray(payload.responsibilities),
          keywords: toStringArray(payload.keywords),
          risks: toStringArray(payload.risks),
          missingRequirements: toStringArray(payload.missing_requirements),
          suggestedPositioning: String(payload.suggested_positioning ?? '').trim(),
          recommendedResumeTitle: String(payload.recommended_resume_title ?? '').trim(),
          recommendedFileName: String(payload.recommended_file_name ?? '').trim(),
          rawJson: response.content,
          estimatedCostUsd: null
        };

        job.status = 'analyzed';
        job.updatedAt = timestamp;
        job.version += 1;

        await Promise.all([
          db.analyses.put(analysis),
          db.jobs.put({ ...job }),
          db.logs.put({
            id: makeId('log'),
            createdAt: timestamp,
            updatedAt: timestamp,
            version: 1,
            type: 'job_analysis',
            status: 'success',
            message: `Analise concluida para ${job.title || 'vaga sem titulo'}.`,
            contextJson: JSON.stringify({
              jobId: job.id,
              model: provider.defaultModel,
              usage: response.usage ?? null,
              fitScore
            })
          })
        ]);

        await this.load();
        await useJobsStore().load();
        await useWorkspaceStore().bootstrap();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao analisar vaga.';

        await db.logs.put({
          id: makeId('log'),
          createdAt: nowIso(),
          updatedAt: nowIso(),
          version: 1,
          type: 'error',
          status: 'error',
          message: `Falha na analise da vaga: ${message}`,
          contextJson: JSON.stringify({ jobId: job.id })
        });

        throw error;
      } finally {
        this.runningJobIds = this.runningJobIds.filter((item) => item !== job.id);
      }
    }
  }
});
