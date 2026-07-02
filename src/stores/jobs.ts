import { defineStore } from 'pinia';
import { db } from '@/db/schema';
import type { JobPost, JobStatus, WorkModel } from '@/domain/entities/types';
import { makeId } from '@/utils/ids';
import { useWorkspaceStore } from '@/stores/workspace';

interface JobsState {
  hydrated: boolean;
  isSaving: boolean;
  jobs: JobPost[];
}

function nowIso(): string {
  return new Date().toISOString();
}

export const useJobsStore = defineStore('jobs', {
  state: (): JobsState => ({
    hydrated: false,
    isSaving: false,
    jobs: []
  }),

  actions: {
    async load() {
      this.jobs = await db.jobs.orderBy('updatedAt').reverse().toArray();
      this.hydrated = true;
    },

    async addJob() {
      const createdAt = nowIso();
      const job: JobPost = {
        id: makeId('job'),
        createdAt,
        updatedAt: createdAt,
        version: 1,
        title: '',
        company: '',
        location: '',
        workModel: null,
        seniority: '',
        source: 'manual',
        originalUrl: '',
        description: '',
        status: 'new',
        capturedAt: createdAt,
        appliedAt: null,
        notes: '',
        searchProfileId: null
      };

      await db.jobs.put(job);
      await db.logs.put({
        id: makeId('log'),
        createdAt,
        updatedAt: createdAt,
        version: 1,
        type: 'job_import',
        status: 'info',
        message: 'Nova vaga local criada.',
        contextJson: JSON.stringify({ jobId: job.id, source: job.source })
      });

      this.jobs = [job, ...this.jobs];
      await this.syncWorkspace();
    },

    async saveJob(job: JobPost) {
      this.isSaving = true;

      try {
        job.updatedAt = nowIso();
        job.version += 1;
        await db.jobs.put({ ...job });
        await this.syncWorkspace();
      } finally {
        this.isSaving = false;
      }
    },

    async changeStatus(job: JobPost, status: JobStatus) {
      job.status = status;
      job.appliedAt = status === 'sent_manual' ? job.appliedAt ?? nowIso() : job.appliedAt;
      job.updatedAt = nowIso();
      job.version += 1;

      await db.jobs.put({ ...job });
      await db.logs.put({
        id: makeId('log'),
        createdAt: job.updatedAt,
        updatedAt: job.updatedAt,
        version: 1,
        type: 'status_change',
        status: 'success',
        message: `Status da vaga alterado para ${status}.`,
        contextJson: JSON.stringify({ jobId: job.id, status })
      });

      await this.syncWorkspace();
    },

    async removeJob(id: string) {
      await db.jobs.delete(id);
      this.jobs = this.jobs.filter((item) => item.id !== id);
      await db.logs.put({
        id: makeId('log'),
        createdAt: nowIso(),
        updatedAt: nowIso(),
        version: 1,
        type: 'job_import',
        status: 'warning',
        message: 'Vaga removida do workspace local.',
        contextJson: JSON.stringify({ jobId: id })
      });
      await this.syncWorkspace();
    },

    async seedOneIfEmpty() {
      if (this.jobs.length === 0) {
        await this.addJob();
      }
    },

    async syncWorkspace() {
      const workspace = useWorkspaceStore();
      await this.load();
      await workspace.bootstrap();
    }
  }
});

export const jobStatusOptions: Array<{ value: JobStatus; label: string }> = [
  { value: 'new', label: 'Nova' },
  { value: 'analyzed', label: 'Analisada' },
  { value: 'resume_generated', label: 'CV gerado' },
  { value: 'ready_to_send', label: 'Pronta para envio' },
  { value: 'sent_manual', label: 'Enviada manualmente' },
  { value: 'interview', label: 'Entrevista' },
  { value: 'rejected', label: 'Recusada' },
  { value: 'archived', label: 'Arquivada' }
];

export const workModelOptions: Array<{ value: WorkModel; label: string }> = [
  { value: null, label: 'Nao definido' },
  { value: 'remote', label: 'remote' },
  { value: 'hybrid', label: 'hybrid' },
  { value: 'onsite', label: 'onsite' }
];
