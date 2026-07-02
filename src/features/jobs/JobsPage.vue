<script setup lang="ts">
import { computed, onMounted, reactive } from 'vue';
import SectionCard from '@/components/ui/SectionCard.vue';
import { openPrintWindow } from '@/services/browserPrint';
import { jobStatusOptions, useJobsStore, workModelOptions } from '@/stores/jobs';
import { useAnalysesStore } from '@/stores/analyses';
import { useAnswersStore } from '@/stores/answers';
import { useResumesStore } from '@/stores/resumes';
import { formatDateTime } from '@/utils/date';

const jobsStore = useJobsStore();
const analysesStore = useAnalysesStore();
const answersStore = useAnswersStore();
const resumesStore = useResumesStore();

const filters = reactive({
  q: '',
  status: '',
  workModel: '',
  source: ''
});

onMounted(async () => {
  await jobsStore.load();
  await analysesStore.load();
  await answersStore.load();
  await resumesStore.load();
});

const filteredJobs = computed(() =>
  jobsStore.jobs.filter((job) => {
    const q = filters.q.trim().toLowerCase();

    if (q !== '') {
      const haystack = [job.title, job.company, job.location, job.description]
        .join(' ')
        .toLowerCase();

      if (! haystack.includes(q)) {
        return false;
      }
    }

    if (filters.status !== '' && job.status !== filters.status) {
      return false;
    }

    if (filters.workModel !== '' && (job.workModel ?? '') !== filters.workModel) {
      return false;
    }

    if (filters.source !== '' && job.source !== filters.source) {
      return false;
    }

    return true;
  })
);

async function analyze(jobId: string) {
  const job = jobsStore.jobs.find((item) => item.id === jobId);

  if (!job) {
    return;
  }

  await analysesStore.analyzeJob(job);
}

async function generateAnswers(jobId: string) {
  const job = jobsStore.jobs.find((item) => item.id === jobId);

  if (!job) {
    return;
  }

  await answersStore.generateAnswers(job);
}

async function generateResume(jobId: string) {
  const job = jobsStore.jobs.find((item) => item.id === jobId);

  if (!job) {
    return;
  }

  await resumesStore.generateResume(job);
}

function openResumePreview(jobId: string) {
  const resume = resumesStore.latestByJobId.get(jobId);

  if (!resume) {
    return;
  }

  const blob = new Blob([resume.htmlSnapshot], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function downloadResumeHtml(jobId: string) {
  const resume = resumesStore.latestByJobId.get(jobId);

  if (!resume) {
    return;
  }

  const blob = new Blob([resume.htmlSnapshot], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = resume.fileName.replace(/\.pdf$/i, '.html');
  anchor.click();
  URL.revokeObjectURL(url);
}

async function printResumePdf(jobId: string) {
  const job = jobsStore.jobs.find((item) => item.id === jobId);

  if (!job) {
    return;
  }

  const resume = await resumesStore.registerPdfIntent(job);
  openPrintWindow(resume.htmlSnapshot, resume.fileName);
}
</script>

<template>
  <div class="page-stack">
    <header class="page-header">
      <div>
        <h1 class="page-title">Vagas</h1>
        <p class="page-subtitle">
          Esta tela sera reescrita como pipeline local: captura, analise, CV, respostas, status e observacoes sem servidor.
        </p>
      </div>
      <div style="display: flex; gap: 12px; flex-wrap: wrap;">
        <button class="btn btn-primary" type="button" @click="jobsStore.addJob">Nova vaga</button>
        <button class="btn btn-secondary" type="button">Colar descricao</button>
      </div>
    </header>

    <SectionCard title="Filtros locais" subtitle="Todos os filtros e a listagem agora rodam 100% no IndexedDB do navegador.">
      <div class="field-grid">
        <label class="field-stack">
          <span class="field-label">Buscar</span>
          <input v-model="filters.q" class="field" placeholder="Titulo, empresa, localidade ou termo">
        </label>
        <label class="field-stack">
          <span class="field-label">Status</span>
          <select v-model="filters.status" class="field">
            <option value="">Todos</option>
            <option v-for="item in jobStatusOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </label>
        <label class="field-stack">
          <span class="field-label">Modelo</span>
          <select v-model="filters.workModel" class="field">
            <option value="">Todos</option>
            <option v-for="item in workModelOptions" :key="item.label" :value="item.value ?? ''">{{ item.label }}</option>
          </select>
        </label>
        <label class="field-stack">
          <span class="field-label">Fonte</span>
          <select v-model="filters.source" class="field">
            <option value="">Todas</option>
            <option value="manual">manual</option>
            <option value="rss">rss</option>
            <option value="public_api">public_api</option>
            <option value="search_web">search_web</option>
          </select>
        </label>
      </div>
    </SectionCard>

    <SectionCard title="Pipeline local" subtitle="Criacao, edicao e status da candidatura persistidos sem backend.">
      <div class="stack-md">
        <article v-for="job in filteredJobs" :key="job.id" class="entry-card">
          <div class="field-grid">
            <label class="field-stack">
              <span class="field-label">Titulo</span>
              <input v-model="job.title" class="field" placeholder="Backend PHP Developer">
            </label>
            <label class="field-stack">
              <span class="field-label">Empresa</span>
              <input v-model="job.company" class="field" placeholder="Empresa">
            </label>
            <label class="field-stack">
              <span class="field-label">Localidade</span>
              <input v-model="job.location" class="field" placeholder="Brasil, Portugal, Lisboa...">
            </label>
            <label class="field-stack">
              <span class="field-label">Senioridade</span>
              <input v-model="job.seniority" class="field" placeholder="junior, mid, senior">
            </label>
            <label class="field-stack">
              <span class="field-label">Modelo</span>
              <select v-model="job.workModel" class="field">
                <option v-for="item in workModelOptions" :key="item.label" :value="item.value">{{ item.label }}</option>
              </select>
            </label>
            <label class="field-stack">
              <span class="field-label">Status</span>
              <select v-model="job.status" class="field">
                <option v-for="item in jobStatusOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
              </select>
            </label>
            <label class="field-stack">
              <span class="field-label">Fonte</span>
              <select v-model="job.source" class="field">
                <option value="manual">manual</option>
                <option value="rss">rss</option>
                <option value="public_api">public_api</option>
                <option value="search_web">search_web</option>
              </select>
            </label>
            <label class="field-stack">
              <span class="field-label">Link original</span>
              <input v-model="job.originalUrl" class="field" placeholder="https://...">
            </label>
            <label class="field-stack" style="grid-column: 1 / -1;">
              <span class="field-label">Descricao</span>
              <textarea v-model="job.description" class="textarea" placeholder="Cole a descricao completa da vaga."></textarea>
            </label>
            <label class="field-stack" style="grid-column: 1 / -1;">
              <span class="field-label">Observacoes</span>
              <textarea v-model="job.notes" class="textarea" placeholder="Notas da candidatura, riscos, follow-up."></textarea>
            </label>
          </div>

          <div class="toolbar" style="margin-top: 16px; justify-content: space-between;">
            <div class="toolbar">
              <span class="pill">{{ job.status }}</span>
              <span class="inline-note">capturada em {{ formatDateTime(job.capturedAt) }}</span>
              <span v-if="job.appliedAt" class="inline-note">enviada em {{ formatDateTime(job.appliedAt) }}</span>
            </div>
            <div class="toolbar">
              <button class="btn btn-primary" type="button" @click="jobsStore.saveJob(job)">Salvar vaga</button>
              <button class="btn btn-secondary" type="button" :disabled="analysesStore.runningJobIds.includes(job.id)" @click="analyze(job.id)">
                {{ analysesStore.runningJobIds.includes(job.id) ? 'Analisando...' : 'Analisar vaga' }}
              </button>
              <button class="btn btn-secondary" type="button" :disabled="resumesStore.runningJobIds.includes(job.id)" @click="generateResume(job.id)">
                {{ resumesStore.runningJobIds.includes(job.id) ? 'Gerando CV...' : 'Gerar CV' }}
              </button>
              <button class="btn btn-secondary" type="button" :disabled="answersStore.runningJobIds.includes(job.id)" @click="generateAnswers(job.id)">
                {{ answersStore.runningJobIds.includes(job.id) ? 'Gerando respostas...' : 'Gerar respostas' }}
              </button>
              <button class="btn btn-secondary" type="button" @click="jobsStore.changeStatus(job, 'sent_manual')">Marcar enviada</button>
              <button class="btn btn-secondary" type="button" @click="jobsStore.removeJob(job.id)">Remover</button>
            </div>
          </div>

          <div v-if="analysesStore.latestByJobId.get(job.id)" class="stack-sm" style="margin-top: 18px;">
            <div class="toolbar">
              <span class="pill">fit {{ analysesStore.latestByJobId.get(job.id)?.fitScore ?? 'n/a' }}</span>
              <span class="pill">{{ analysesStore.latestByJobId.get(job.id)?.fitLabel }}</span>
            </div>
            <p class="inline-note">{{ analysesStore.latestByJobId.get(job.id)?.fitSummary || 'Sem resumo ainda.' }}</p>
            <p v-if="analysesStore.latestByJobId.get(job.id)?.recommendedResumeTitle" class="inline-note">
              titulo sugerido: {{ analysesStore.latestByJobId.get(job.id)?.recommendedResumeTitle }}
            </p>
          </div>

          <div v-if="resumesStore.latestByJobId.get(job.id)" class="stack-sm" style="margin-top: 18px;">
            <div class="toolbar">
              <span class="pill">cv local gerado</span>
              <span class="inline-note">{{ resumesStore.latestByJobId.get(job.id)?.fileName }}</span>
            </div>
            <p class="inline-note">
              {{ resumesStore.latestByJobId.get(job.id)?.title || 'Sem titulo estruturado.' }}
            </p>
            <p class="inline-note">
              Para gerar o PDF final, use a impressao do navegador e selecione "Salvar como PDF".
            </p>
            <div class="toolbar">
              <button class="btn btn-secondary" type="button" @click="openResumePreview(job.id)">Abrir preview</button>
              <button class="btn btn-primary" type="button" :disabled="resumesStore.preparingPdfJobIds.includes(job.id)" @click="printResumePdf(job.id)">
                {{ resumesStore.preparingPdfJobIds.includes(job.id) ? 'Abrindo impressao...' : 'Imprimir / PDF' }}
              </button>
              <button class="btn btn-secondary" type="button" @click="downloadResumeHtml(job.id)">Baixar HTML</button>
            </div>
          </div>

          <div v-if="answersStore.latestByJobId.get(job.id)?.length" class="stack-sm" style="margin-top: 18px;">
            <div class="toolbar">
              <span class="pill">{{ answersStore.latestByJobId.get(job.id)?.length }} respostas</span>
              <span class="inline-note">Saida local pronta para copiar e adaptar nos formularios.</span>
            </div>

            <details>
              <summary class="inline-note">Ver respostas geradas</summary>

              <div class="stack-sm" style="margin-top: 14px;">
                <article v-for="answer in answersStore.latestByJobId.get(job.id)" :key="answer.id" class="entry-card">
                  <strong>{{ answer.question }}</strong>
                  <p class="inline-note" style="margin: 10px 0 4px;">curta</p>
                  <p>{{ answer.shortVersion || 'Sem versao curta.' }}</p>
                  <p class="inline-note" style="margin: 12px 0 4px;">media</p>
                  <p>{{ answer.mediumVersion || 'Sem versao media.' }}</p>
                  <p class="inline-note" style="margin: 12px 0 4px;">longa</p>
                  <p>{{ answer.longVersion || 'Sem versao longa.' }}</p>
                </article>
              </div>
            </details>
          </div>
        </article>
      </div>
    </SectionCard>
  </div>
</template>
