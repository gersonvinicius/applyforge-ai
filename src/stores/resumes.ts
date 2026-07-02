import { defineStore } from 'pinia';
import { db } from '@/db/schema';
import type {
  Education,
  Experience,
  JobAnalysis,
  JobPost,
  Profile,
  ResumeVersion,
  Skill
} from '@/domain/entities/types';
import { renderGenerateResumePrompt } from '@/prompts/generateResumePrompt';
import { renderResumeHtml, type ResumePayload } from '@/services/resumeRenderer';
import { runOpenRouterJsonPrompt } from '@/services/openRouter';
import { useAiProvidersStore } from '@/stores/aiProviders';
import { useJobsStore } from '@/stores/jobs';
import { useWorkspaceStore } from '@/stores/workspace';
import { makeResumeFileName } from '@/utils/resumeFileName';
import { makeId } from '@/utils/ids';

interface ResumesState {
  hydrated: boolean;
  runningJobIds: string[];
  preparingPdfJobIds: string[];
  resumes: ResumeVersion[];
}

function nowIso(): string {
  return new Date().toISOString();
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

function safeJsonParse(raw: string): ResumePayload {
  const parsed = JSON.parse(raw) as ResumePayload;

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Geracao de CV retornou JSON invalido.');
  }

  return parsed;
}

function pickLatestAnalysis(analyses: JobAnalysis[]): JobAnalysis | null {
  if (analyses.length === 0) {
    return null;
  }

  return analyses.reduce((latest, current) =>
    current.updatedAt > latest.updatedAt ? current : latest
  );
}

function linkedinResumeText(rawText: string | null): string {
  if (!rawText || rawText.trim() === '') {
    return 'N/A';
  }

  return rawText;
}

function layoutReferenceGuidance(profile: Profile, layoutAssetName: string | null): string {
  if (profile.resumeTemplate !== 'reference_pdf') {
    return `Usar template ${profile.resumeTemplate} com estrutura ATS-friendly e leitura objetiva.`;
  }

  if (!profile.resumeLayoutAssetId || !layoutAssetName) {
    return 'Usuario selecionou template reference_pdf, mas ainda nao anexou um PDF de layout. Use uma estrutura densa, tecnica e compacta.';
  }

  return `Usuario anexou um PDF de layout chamado ${layoutAssetName}. Extracao textual/fiel do PDF ainda nao existe no browser MVP, entao preserve um estilo tecnico, compacto e mais denso.`;
}

export const useResumesStore = defineStore('resumes', {
  state: (): ResumesState => ({
    hydrated: false,
    runningJobIds: [],
    preparingPdfJobIds: [],
    resumes: []
  }),

  getters: {
    latestByJobId(state) {
      const map = new Map<string, ResumeVersion>();

      for (const resume of state.resumes) {
        const current = map.get(resume.jobPostId);

        if (!current || resume.updatedAt > current.updatedAt) {
          map.set(resume.jobPostId, resume);
        }
      }

      return map;
    }
  },

  actions: {
    async load() {
      this.resumes = await db.resumes.orderBy('updatedAt').reverse().toArray();
      this.hydrated = true;
    },

    async generateResume(job: JobPost) {
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
        throw new Error('Configure a API key do OpenRouter antes de gerar o CV.');
      }

      const [profile, experiences, educations, skills, analyses] = await Promise.all([
        db.profile.toCollection().first().then((value) => value ?? null),
        db.experiences.orderBy('sortOrder').toArray(),
        db.educations.toArray(),
        db.skills.toArray(),
        db.analyses.where('jobPostId').equals(job.id).toArray()
      ]);

      if (!profile) {
        throw new Error('Preencha o perfil base antes de gerar o CV.');
      }

      const latestAnalysis = pickLatestAnalysis(analyses);

      if (!latestAnalysis) {
        throw new Error('Analise a vaga antes de gerar o CV.');
      }

      const [linkedinAsset, layoutAsset] = await Promise.all([
        profile.linkedinResumeAssetId ? db.assets.get(profile.linkedinResumeAssetId) : Promise.resolve(null),
        profile.resumeLayoutAssetId ? db.assets.get(profile.resumeLayoutAssetId) : Promise.resolve(null)
      ]);

      this.runningJobIds = [...this.runningJobIds, job.id];

      try {
        const linkedinImport = linkedinAsset
          ? await import('@/services/linkedinResumeImport')
          : null;
        const extractedLinkedinResume = linkedinAsset
          ? await linkedinImport!.extractLinkedInResumeImport(linkedinAsset)
          : null;
        const prompt = renderGenerateResumePrompt({
          profileJson: profilePayload(profile, experiences, educations, skills),
          linkedinResumeText: linkedinResumeText(extractedLinkedinResume?.rawText ?? null),
          jobJson: job,
          analysisJson: latestAnalysis,
          resumeTemplate: profile.resumeTemplate,
          layoutReferenceGuidance: layoutReferenceGuidance(profile, layoutAsset?.fileName ?? null)
        });

        const response = await runOpenRouterJsonPrompt(provider, prompt);
        const payload = safeJsonParse(response.content);
        const timestamp = nowIso();
        const fileName = makeResumeFileName(profile.fullName, latestAnalysis.recommendedResumeTitle || job.title);
        const htmlSnapshot = renderResumeHtml(profile, payload);

        const resume: ResumeVersion = {
          id: makeId('resume'),
          createdAt: timestamp,
          updatedAt: timestamp,
          version: 1,
          jobPostId: job.id,
          profileId: profile.id,
          provider: provider.provider,
          model: provider.defaultModel,
          title: String(payload.title ?? payload.recommended_resume_title ?? latestAnalysis.recommendedResumeTitle ?? job.title).trim(),
          fileName,
          htmlSnapshot,
          pdfAssetId: null,
          estimatedCostUsd: null
        };

        job.status = 'resume_generated';
        job.updatedAt = timestamp;
        job.version += 1;

        await Promise.all([
          db.resumes.put(resume),
          db.jobs.put({ ...job }),
          db.logs.put({
            id: makeId('log'),
            createdAt: timestamp,
            updatedAt: timestamp,
            version: 1,
            type: 'resume_generation',
            status: 'success',
            message: `CV adaptado gerado para ${job.title || 'vaga sem titulo'}.`,
            contextJson: JSON.stringify({
              jobId: job.id,
              model: provider.defaultModel,
              fileName,
              usage: response.usage ?? null
            })
          })
        ]);

        await this.load();
        await useJobsStore().load();
        await useWorkspaceStore().bootstrap();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao gerar CV.';
        const timestamp = nowIso();

        await db.logs.put({
          id: makeId('log'),
          createdAt: timestamp,
          updatedAt: timestamp,
          version: 1,
          type: 'error',
          status: 'error',
          message: `Falha na geracao de CV: ${message}`,
          contextJson: JSON.stringify({ jobId: job.id })
        });

        throw error;
      } finally {
        this.runningJobIds = this.runningJobIds.filter((item) => item !== job.id);
      }
    },

    async registerPdfIntent(job: JobPost): Promise<ResumeVersion> {
      const resume = this.latestByJobId.get(job.id);

      if (!resume) {
        throw new Error('Gere um CV antes de exportar para PDF.');
      }

      if (this.preparingPdfJobIds.includes(job.id)) {
        return resume;
      }

      this.preparingPdfJobIds = [...this.preparingPdfJobIds, job.id];

      try {
        const timestamp = nowIso();
        const blockedStatuses = new Set(['sent_manual', 'interview', 'rejected', 'archived']);

        if (!blockedStatuses.has(job.status)) {
          job.status = 'ready_to_send';
          job.updatedAt = timestamp;
          job.version += 1;
          await db.jobs.put({ ...job });
        }

        await db.logs.put({
          id: makeId('log'),
          createdAt: timestamp,
          updatedAt: timestamp,
          version: 1,
          type: 'pdf_generation',
          status: 'success',
          message: `Exportacao PDF iniciada para ${resume.fileName}.`,
          contextJson: JSON.stringify({
            jobId: job.id,
            resumeId: resume.id,
            fileName: resume.fileName,
            mode: 'browser_print'
          })
        });

        await useJobsStore().load();
        await useWorkspaceStore().bootstrap();

        return resume;
      } finally {
        this.preparingPdfJobIds = this.preparingPdfJobIds.filter((item) => item !== job.id);
      }
    }
  }
});
