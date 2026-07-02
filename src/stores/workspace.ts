import { defineStore } from 'pinia';
import { db } from '@/db/schema';
import type {
  ActivityLog,
  JobPost,
  Profile,
  SearchProfile,
  WorkspaceSnapshot
} from '@/domain/entities/types';
import {
  exportWorkspaceSnapshot,
  importWorkspaceSnapshot,
  resetWorkspace
} from '@/db/repositories/workspaceRepository';
import { makeId } from '@/utils/ids';

interface WorkspaceMetrics {
  jobs: number;
  analyzed: number;
  answers: number;
  resumes: number;
  activeSearchProfiles: number;
  logs: number;
}

interface WorkspaceState {
  isBootstrapped: boolean;
  profile: Profile | null;
  recentJobs: JobPost[];
  recentLogs: ActivityLog[];
  searchProfiles: SearchProfile[];
  metrics: WorkspaceMetrics;
}

export const useWorkspaceStore = defineStore('workspace', {
  state: (): WorkspaceState => ({
    isBootstrapped: false,
    profile: null,
    recentJobs: [],
    recentLogs: [],
    searchProfiles: [],
      metrics: {
        jobs: 0,
        analyzed: 0,
        answers: 0,
        resumes: 0,
        activeSearchProfiles: 0,
        logs: 0
      }
  }),

  actions: {
    async bootstrap() {
      const [profile, jobs, logs, searchProfiles, resumesCount] = await Promise.all([
        db.profile.toCollection().first().then((value) => value ?? null),
        db.jobs.orderBy('updatedAt').reverse().limit(5).toArray(),
        db.logs.orderBy('createdAt').reverse().limit(6).toArray(),
        db.searchProfiles.orderBy('updatedAt').reverse().toArray(),
        db.resumes.count()
      ]);

      this.profile = profile;
      this.recentJobs = jobs;
      this.recentLogs = logs;
      this.searchProfiles = searchProfiles;
      this.metrics = {
        jobs: await db.jobs.count(),
        analyzed: await db.analyses.count(),
        answers: await db.answers.count(),
        resumes: resumesCount,
        activeSearchProfiles: searchProfiles.filter((item) => item.isActive).length,
        logs: await db.logs.count()
      };
      this.isBootstrapped = true;
    },

    async seedLocalWorkspace() {
      const existingProfile = await db.profile.toCollection().first();

      if (existingProfile) {
        await this.bootstrap();
        return;
      }

      const now = new Date().toISOString();
      const profileId = makeId('profile');
      const searchProfileId = makeId('search');
      const jobId = makeId('job');

      await db.transaction(
        'rw',
        db.profile,
        db.jobs,
        db.searchProfiles,
        db.logs,
        async () => {
          await db.profile.put({
            id: profileId,
            createdAt: now,
            updatedAt: now,
            version: 1,
            fullName: 'Seu nome aqui',
            headline: 'Full Stack Developer',
            phone: '',
            email: '',
            city: 'Sao Paulo',
            state: 'SP',
            country: 'Brasil',
            linkedinUrl: '',
            githubUrl: '',
            baseSummary: 'Resumo base do candidato para futuras adaptacoes.',
            baseObjective: 'Objetivo profissional base para vagas aderentes.',
            targetSeniority: 'senior',
            preferredWorkModel: 'remote',
            salaryExpectation: '',
            resumeTemplate: 'classic',
            linkedinResumeAssetId: null,
            resumeLayoutAssetId: null
          });

          await db.searchProfiles.put({
            id: searchProfileId,
            createdAt: now,
            updatedAt: now,
            version: 1,
            name: 'Busca PHP remoto',
            keywords: 'php\nlaravel',
            location: 'Brasil',
            workModel: 'remote',
            seniority: 'senior',
            provider: 'rss',
            sourceType: 'rss',
            countryCode: 'br',
            postedWithin: '7d',
            applicationType: '',
            sourceUrl: 'https://weworkremotely.com/remote-jobs.rss',
            targetDomains: [],
            frequency: 'manual',
            isActive: true,
            notes: 'Exemplo local-first',
            lastRanAt: null
          });

          await db.jobs.put({
            id: jobId,
            createdAt: now,
            updatedAt: now,
            version: 1,
            title: 'Backend PHP Developer',
            company: 'ApplyForge Sample',
            location: 'Brasil',
            workModel: 'remote',
            seniority: 'senior',
            source: 'manual',
            originalUrl: 'https://example.com/jobs/backend-php',
            description: 'Vaga de exemplo para validar fluxo local-first sem backend.',
            status: 'new',
            capturedAt: now,
            appliedAt: null,
            notes: 'Registro seed do scaffold.',
            searchProfileId
          });

          await db.logs.put({
            id: makeId('log'),
            createdAt: now,
            updatedAt: now,
            version: 1,
            type: 'backup',
            status: 'info',
            message: 'Workspace local inicializado com dados seed.',
            contextJson: JSON.stringify({ profileId, searchProfileId, jobId })
          });
        }
      );

      await this.bootstrap();
    },

    async exportSnapshot(): Promise<WorkspaceSnapshot> {
      return exportWorkspaceSnapshot();
    },

    async wipeWorkspace(): Promise<void> {
      await resetWorkspace();
      this.$reset();
    },

    async importSnapshot(snapshot: WorkspaceSnapshot): Promise<void> {
      await importWorkspaceSnapshot(snapshot);
      await this.bootstrap();
    }
  }
});
