import { defineStore } from 'pinia';
import { db } from '@/db/schema';
import type {
  ApplicationAnswer,
  Education,
  Experience,
  JobAnalysis,
  JobPost,
  Profile,
  Skill
} from '@/domain/entities/types';
import { renderGenerateAnswersPrompt } from '@/prompts/generateAnswersPrompt';
import { runOpenRouterJsonPrompt } from '@/services/openRouter';
import { useAiProvidersStore } from '@/stores/aiProviders';
import { useWorkspaceStore } from '@/stores/workspace';
import { makeId } from '@/utils/ids';

interface AnswersState {
  hydrated: boolean;
  runningJobIds: string[];
  answers: ApplicationAnswer[];
}

interface ParsedAnswerItem {
  question?: string;
  short_answer?: string;
  medium_answer?: string;
  long_answer?: string;
}

interface ParsedAnswersPayload {
  answers: ParsedAnswerItem[];
}

function nowIso(): string {
  return new Date().toISOString();
}

function slugifyQuestion(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

function safeJsonParse(raw: string): ParsedAnswersPayload {
  const parsed = JSON.parse(raw) as { answers?: ParsedAnswerItem[] };

  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.answers)) {
    throw new Error('Geracao de respostas retornou JSON invalido.');
  }

  return {
    answers: parsed.answers
  };
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

function pickLatestAnalysis(analyses: JobAnalysis[]): JobAnalysis | null {
  if (analyses.length === 0) {
    return null;
  }

  return analyses.reduce((latest, current) =>
    current.updatedAt > latest.updatedAt ? current : latest
  );
}

export const useAnswersStore = defineStore('answers', {
  state: (): AnswersState => ({
    hydrated: false,
    runningJobIds: [],
    answers: []
  }),

  getters: {
    latestByJobId(state) {
      const grouped = new Map<string, Map<string, ApplicationAnswer>>();

      for (const answer of state.answers) {
        const answersByPrompt = grouped.get(answer.jobPostId) ?? new Map<string, ApplicationAnswer>();
        const current = answersByPrompt.get(answer.promptKey);

        if (!current || answer.updatedAt > current.updatedAt) {
          answersByPrompt.set(answer.promptKey, answer);
        }

        grouped.set(answer.jobPostId, answersByPrompt);
      }

      const latest = new Map<string, ApplicationAnswer[]>();

      for (const [jobId, answersByPrompt] of grouped.entries()) {
        latest.set(
          jobId,
          [...answersByPrompt.values()].sort((left, right) => left.sortOrder - right.sortOrder)
        );
      }

      return latest;
    }
  },

  actions: {
    async load() {
      this.answers = await db.answers.orderBy('updatedAt').reverse().toArray();
      this.hydrated = true;
    },

    async generateAnswers(job: JobPost) {
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
        throw new Error('Configure a API key do OpenRouter antes de gerar respostas.');
      }

      const [profile, experiences, educations, skills, analyses] = await Promise.all([
        db.profile.toCollection().first().then((value) => value ?? null),
        db.experiences.orderBy('sortOrder').toArray(),
        db.educations.toArray(),
        db.skills.toArray(),
        db.analyses.where('jobPostId').equals(job.id).toArray()
      ]);

      if (!profile) {
        throw new Error('Preencha o perfil base antes de gerar respostas.');
      }

      const latestAnalysis = pickLatestAnalysis(analyses);

      if (!latestAnalysis) {
        throw new Error('Analise a vaga antes de gerar respostas.');
      }

      this.runningJobIds = [...this.runningJobIds, job.id];

      try {
        const prompt = renderGenerateAnswersPrompt({
          profileJson: profilePayload(profile, experiences, educations, skills),
          jobJson: job,
          analysisJson: latestAnalysis
        });

        const response = await runOpenRouterJsonPrompt(provider, prompt);
        const payload = safeJsonParse(response.content);

        if (payload.answers.length === 0) {
          throw new Error('A IA nao retornou respostas aproveitaveis para a vaga.');
        }

        const timestamp = nowIso();
        const answers: ApplicationAnswer[] = [];

        for (const [index, item] of payload.answers.entries()) {
          const question = String(item.question ?? '').trim();

          if (question === '') {
            continue;
          }

          const answer: ApplicationAnswer = {
            id: makeId('answer'),
            createdAt: timestamp,
            updatedAt: timestamp,
            version: 1,
            jobPostId: job.id,
            provider: provider.provider,
            model: provider.defaultModel,
            question,
            promptKey: slugifyQuestion(question) || `pergunta_${index + 1}`,
            sortOrder: index + 1,
            shortVersion: String(item.short_answer ?? '').trim(),
            mediumVersion: String(item.medium_answer ?? '').trim(),
            longVersion: String(item.long_answer ?? '').trim(),
            estimatedCostUsd: null
          };

          if (answer.shortVersion || answer.mediumVersion || answer.longVersion) {
            answers.push(answer);
          }
        }

        if (answers.length === 0) {
          throw new Error('A IA retornou respostas vazias para a vaga.');
        }

        await Promise.all([
          db.answers.bulkPut(answers),
          db.logs.put({
            id: makeId('log'),
            createdAt: timestamp,
            updatedAt: timestamp,
            version: 1,
            type: 'answer_generation',
            status: 'success',
            message: `Respostas geradas para ${job.title || 'vaga sem titulo'}.`,
            contextJson: JSON.stringify({
              jobId: job.id,
              model: provider.defaultModel,
              answerCount: answers.length,
              usage: response.usage ?? null
            })
          })
        ]);

        await this.load();
        await useWorkspaceStore().bootstrap();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao gerar respostas.';
        const timestamp = nowIso();

        await db.logs.put({
          id: makeId('log'),
          createdAt: timestamp,
          updatedAt: timestamp,
          version: 1,
          type: 'error',
          status: 'error',
          message: `Falha na geracao de respostas: ${message}`,
          contextJson: JSON.stringify({ jobId: job.id })
        });

        throw error;
      } finally {
        this.runningJobIds = this.runningJobIds.filter((item) => item !== job.id);
      }
    }
  }
});
