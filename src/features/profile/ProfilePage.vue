<script setup lang="ts">
import { onMounted, ref } from 'vue';
import SectionCard from '@/components/ui/SectionCard.vue';
import { useProfileStore } from '@/stores/profile';
import type { Education, Experience, Skill } from '@/domain/entities/types';

const profileStore = useProfileStore();
const linkedinResumeInput = ref<HTMLInputElement | null>(null);
const resumeLayoutInput = ref<HTMLInputElement | null>(null);
const linkedinImportFeedback = ref('');
const linkedinImportTone = ref<'info' | 'success' | 'error'>('info');

const seniorityOptions = ['junior', 'mid', 'senior', 'staff'];
const workModelOptions = ['remote', 'hybrid', 'onsite'];
const resumeTemplateOptions = [
  { value: 'classic', label: 'classic' },
  { value: 'compact', label: 'compact' },
  { value: 'reference_pdf', label: 'reference_pdf' }
];
const experienceTypes = [
  { value: 'real', label: 'real' },
  { value: 'complementary', label: 'complementar' },
  { value: 'personal_project', label: 'projeto pessoal' }
];
const skillCategories = ['backend', 'frontend', 'database', 'cloud', 'devops', 'ai', 'architecture', 'tests', 'soft_skill'];
const skillLevels = ['basic', 'intermediate', 'advanced'];
const evidenceTypes = ['real_experience', 'complementary_knowledge', 'studying'];

onMounted(async () => {
  await profileStore.load();
});

function listToString(values: string[]): string {
  return values.join(', ');
}

function stringToList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

async function saveExperience(item: Experience) {
  await profileStore.saveExperience(item);
}

async function saveEducation(item: Education) {
  await profileStore.saveEducation(item);
}

async function saveSkill(item: Skill) {
  await profileStore.saveSkill(item);
}

function formatBytes(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function triggerLinkedinResumeUpload() {
  linkedinResumeInput.value?.click();
}

function triggerResumeLayoutUpload() {
  resumeLayoutInput.value?.click();
}

async function handleLinkedinResumeUpload(event: Event) {
  const target = event.target as HTMLInputElement | null;
  const file = target?.files?.[0];

  if (!file) {
    return;
  }

  try {
    await profileStore.setLinkedinResumeAsset(file);
    const summary = await profileStore.importLinkedinResumeIntoProfile();
    linkedinImportFeedback.value = `Importacao concluida: ${summary.experiencesAdded} experiencias, ${summary.educationsAdded} formacoes e ${summary.skillsAdded} competencias adicionadas.`;
    linkedinImportTone.value = 'success';
  } catch (error) {
    linkedinImportFeedback.value = error instanceof Error ? error.message : 'Falha ao importar o PDF do LinkedIn.';
    linkedinImportTone.value = 'error';
  }

  if (target) {
    target.value = '';
  }
}

async function handleResumeLayoutUpload(event: Event) {
  const target = event.target as HTMLInputElement | null;
  const file = target?.files?.[0];

  if (!file) {
    return;
  }

  await profileStore.setResumeLayoutAsset(file);

  if (target) {
    target.value = '';
  }
}

async function importExistingLinkedinResume() {
  try {
    const summary = await profileStore.importLinkedinResumeIntoProfile();
    linkedinImportFeedback.value = `Importacao concluida: ${summary.experiencesAdded} experiencias, ${summary.educationsAdded} formacoes e ${summary.skillsAdded} competencias adicionadas.`;
    linkedinImportTone.value = 'success';
  } catch (error) {
    linkedinImportFeedback.value = error instanceof Error ? error.message : 'Falha ao importar o PDF do LinkedIn.';
    linkedinImportTone.value = 'error';
  }
}
</script>

<template>
  <div class="page-stack">
    <header class="page-header">
      <div>
        <h1 class="page-title">Perfil profissional</h1>
        <p class="page-subtitle">
          Esta area vai concentrar perfil base, experiencias, formacoes e competencias com autosave local em IndexedDB.
        </p>
      </div>
      <div class="toolbar">
        <button class="btn btn-primary" type="button" @click="profileStore.saveProfile">Salvar perfil</button>
      </div>
    </header>

    <SectionCard title="Perfil base" subtitle="Primeiro bloco funcional do rebuild: edicao e persistencia local do perfil principal.">
      <div v-if="profileStore.profile" class="field-grid">
        <label class="field-stack">
          <span class="field-label">Nome completo</span>
          <input v-model="profileStore.profile.fullName" class="field" placeholder="Nome completo">
        </label>
        <label class="field-stack">
          <span class="field-label">Headline</span>
          <input v-model="profileStore.profile.headline" class="field" placeholder="Full Stack Developer">
        </label>
        <label class="field-stack">
          <span class="field-label">Telefone</span>
          <input v-model="profileStore.profile.phone" class="field" placeholder="+55 11 99999-9999">
        </label>
        <label class="field-stack">
          <span class="field-label">E-mail</span>
          <input v-model="profileStore.profile.email" class="field" placeholder="voce@email.com">
        </label>
        <label class="field-stack">
          <span class="field-label">Cidade</span>
          <input v-model="profileStore.profile.city" class="field" placeholder="Sao Paulo">
        </label>
        <label class="field-stack">
          <span class="field-label">Estado</span>
          <input v-model="profileStore.profile.state" class="field" placeholder="SP">
        </label>
        <label class="field-stack">
          <span class="field-label">Pais</span>
          <input v-model="profileStore.profile.country" class="field" placeholder="Brasil">
        </label>
        <label class="field-stack">
          <span class="field-label">Senioridade alvo</span>
          <select v-model="profileStore.profile.targetSeniority" class="field">
            <option value="">Selecione</option>
            <option v-for="item in seniorityOptions" :key="item" :value="item">{{ item }}</option>
          </select>
        </label>
        <label class="field-stack">
          <span class="field-label">LinkedIn</span>
          <input v-model="profileStore.profile.linkedinUrl" class="field" placeholder="https://linkedin.com/in/...">
        </label>
        <label class="field-stack">
          <span class="field-label">GitHub</span>
          <input v-model="profileStore.profile.githubUrl" class="field" placeholder="https://github.com/...">
        </label>
        <label class="field-stack">
          <span class="field-label">Modelo preferido</span>
          <select v-model="profileStore.profile.preferredWorkModel" class="field">
            <option :value="null">Selecione</option>
            <option v-for="item in workModelOptions" :key="item" :value="item">{{ item }}</option>
          </select>
        </label>
        <label class="field-stack">
          <span class="field-label">Pretensao salarial</span>
          <input v-model="profileStore.profile.salaryExpectation" class="field" placeholder="Opcional">
        </label>
        <label class="field-stack">
          <span class="field-label">Template de CV</span>
          <select v-model="profileStore.profile.resumeTemplate" class="field">
            <option v-for="item in resumeTemplateOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </label>
        <label class="field-stack" style="grid-column: 1 / -1;">
          <span class="field-label">Resumo base</span>
          <textarea v-model="profileStore.profile.baseSummary" class="textarea" placeholder="Resumo profissional base."></textarea>
        </label>
        <label class="field-stack" style="grid-column: 1 / -1;">
          <span class="field-label">Objetivo base</span>
          <textarea v-model="profileStore.profile.baseObjective" class="textarea" placeholder="Objetivo profissional base."></textarea>
        </label>
      </div>
    </SectionCard>

    <SectionCard title="Documentos locais" subtitle="PDFs base ficam somente neste navegador e entram no backup local exportado.">
      <div class="grid-2">
        <article class="entry-card">
          <div class="stack-sm">
            <strong>LinkedIn PDF</strong>
            <p class="inline-note">Arquivo usado como apoio factual para enriquecer importacao e futuras adaptacoes.</p>
            <div v-if="profileStore.linkedinResumeAsset" class="stack-sm">
              <span class="pill">{{ profileStore.linkedinResumeAsset.fileName }}</span>
              <span class="inline-note">{{ formatBytes(profileStore.linkedinResumeAsset.size) }} • {{ profileStore.linkedinResumeAsset.mimeType }}</span>
            </div>
            <div v-else class="inline-note">Nenhum PDF do LinkedIn salvo neste dispositivo.</div>
            <div v-if="linkedinImportFeedback" class="inline-note" :style="{ color: linkedinImportTone === 'error' ? '#a3362e' : linkedinImportTone === 'success' ? '#1f7a53' : '#6d5b4d' }">
              {{ linkedinImportFeedback }}
            </div>
            <div class="toolbar">
              <button class="btn btn-primary" type="button" @click="triggerLinkedinResumeUpload">Adicionar PDF</button>
              <button class="btn btn-secondary" type="button" :disabled="!profileStore.linkedinResumeAsset || profileStore.isImportingLinkedinResume" @click="importExistingLinkedinResume">
                {{ profileStore.isImportingLinkedinResume ? 'Importando...' : 'Importar no perfil' }}
              </button>
              <button class="btn btn-secondary" type="button" :disabled="!profileStore.linkedinResumeAsset" @click="profileStore.removeLinkedinResumeAsset">Remover</button>
            </div>
            <input
              ref="linkedinResumeInput"
              type="file"
              accept="application/pdf"
              style="display: none;"
              @change="handleLinkedinResumeUpload"
            >
          </div>
        </article>

        <article class="entry-card">
          <div class="stack-sm">
            <strong>Layout de CV</strong>
            <p class="inline-note">Referencia visual para os CVs adaptados. Se ausente, o app usa um template padrao.</p>
            <div v-if="profileStore.resumeLayoutAsset" class="stack-sm">
              <span class="pill">{{ profileStore.resumeLayoutAsset.fileName }}</span>
              <span class="inline-note">{{ formatBytes(profileStore.resumeLayoutAsset.size) }} • {{ profileStore.resumeLayoutAsset.mimeType }}</span>
            </div>
            <div v-else class="inline-note">Nenhum layout PDF salvo neste dispositivo.</div>
            <div class="toolbar">
              <button class="btn btn-primary" type="button" @click="triggerResumeLayoutUpload">Adicionar layout</button>
              <button class="btn btn-secondary" type="button" :disabled="!profileStore.resumeLayoutAsset" @click="profileStore.removeResumeLayoutAsset">Remover</button>
            </div>
            <input
              ref="resumeLayoutInput"
              type="file"
              accept="application/pdf"
              style="display: none;"
              @change="handleResumeLayoutUpload"
            >
          </div>
        </article>
      </div>
    </SectionCard>

    <SectionCard title="Experiencias" subtitle="CRUD local com persistencia no IndexedDB.">
      <template #actions>
        <button class="btn btn-secondary" type="button" @click="profileStore.addExperience">Adicionar experiencia</button>
      </template>

      <div class="stack-md">
        <article v-for="item in profileStore.experiences" :key="item.id" class="entry-card">
          <div class="field-grid">
            <label class="field-stack">
              <span class="field-label">Empresa</span>
              <input v-model="item.company" class="field" placeholder="Empresa">
            </label>
            <label class="field-stack">
              <span class="field-label">Cargo</span>
              <input v-model="item.role" class="field" placeholder="Cargo">
            </label>
            <label class="field-stack">
              <span class="field-label">Data inicial</span>
              <input v-model="item.startDate" class="field" placeholder="2022-01">
            </label>
            <label class="field-stack">
              <span class="field-label">Data final</span>
              <input v-model="item.endDate" class="field" :disabled="item.isCurrent" placeholder="2024-06">
            </label>
            <label class="field-stack">
              <span class="field-label">Tipo</span>
              <select v-model="item.experienceType" class="field">
                <option v-for="option in experienceTypes" :key="option.value" :value="option.value">{{ option.label }}</option>
              </select>
            </label>
            <label class="field-stack" style="align-content: end;">
              <span class="field-label">Atual?</span>
              <input v-model="item.isCurrent" type="checkbox">
            </label>
            <label class="field-stack" style="grid-column: 1 / -1;">
              <span class="field-label">Resumo</span>
              <textarea v-model="item.summary" class="textarea" placeholder="Resumo geral da experiencia."></textarea>
            </label>
            <label class="field-stack">
              <span class="field-label">Atividades</span>
              <input
                :value="listToString(item.activities)"
                class="field"
                placeholder="API REST, sustentacao, arquitetura"
                @input="item.activities = stringToList(($event.target as HTMLInputElement).value)"
              >
            </label>
            <label class="field-stack">
              <span class="field-label">Tecnologias</span>
              <input
                :value="listToString(item.technologies)"
                class="field"
                placeholder="PHP, Laravel, MySQL"
                @input="item.technologies = stringToList(($event.target as HTMLInputElement).value)"
              >
            </label>
            <label class="field-stack" style="grid-column: 1 / -1;">
              <span class="field-label">Destaques</span>
              <input
                :value="listToString(item.highlights)"
                class="field"
                placeholder="Reducao de custo, escala, performance"
                @input="item.highlights = stringToList(($event.target as HTMLInputElement).value)"
              >
            </label>
          </div>
          <div class="toolbar" style="margin-top: 16px;">
            <button class="btn btn-primary" type="button" @click="saveExperience(item)">Salvar experiencia</button>
            <button class="btn btn-secondary" type="button" @click="profileStore.removeExperience(item.id)">Remover</button>
          </div>
        </article>
      </div>
    </SectionCard>

    <div class="grid-2">
      <SectionCard title="Formacoes" subtitle="Persistencia local da base academica.">
        <template #actions>
          <button class="btn btn-secondary" type="button" @click="profileStore.addEducation">Adicionar formacao</button>
        </template>

        <div class="stack-md">
          <article v-for="item in profileStore.educations" :key="item.id" class="entry-card">
            <div class="field-grid">
              <label class="field-stack">
                <span class="field-label">Instituicao</span>
                <input v-model="item.institution" class="field" placeholder="Instituicao">
              </label>
              <label class="field-stack">
                <span class="field-label">Curso</span>
                <input v-model="item.course" class="field" placeholder="Curso">
              </label>
              <label class="field-stack">
                <span class="field-label">Tipo</span>
                <input v-model="item.degreeType" class="field" placeholder="Graduacao, MBA...">
              </label>
              <label class="field-stack">
                <span class="field-label">Status</span>
                <input v-model="item.status" class="field" placeholder="Concluido, cursando...">
              </label>
              <label class="field-stack">
                <span class="field-label">Conclusao</span>
                <input v-model="item.completionDate" class="field" placeholder="2023-12">
              </label>
            </div>
            <div class="toolbar" style="margin-top: 16px;">
              <button class="btn btn-primary" type="button" @click="saveEducation(item)">Salvar formacao</button>
              <button class="btn btn-secondary" type="button" @click="profileStore.removeEducation(item.id)">Remover</button>
            </div>
          </article>
        </div>
      </SectionCard>

      <SectionCard title="Competencias" subtitle="Categorias e evidencia do conhecimento localmente persistidas.">
        <template #actions>
          <button class="btn btn-secondary" type="button" @click="profileStore.addSkill">Adicionar competencia</button>
        </template>

        <div class="stack-md">
          <article v-for="item in profileStore.skills" :key="item.id" class="entry-card">
            <div class="field-grid">
              <label class="field-stack">
                <span class="field-label">Competencia</span>
                <input v-model="item.name" class="field" placeholder="Laravel">
              </label>
              <label class="field-stack">
                <span class="field-label">Categoria</span>
                <select v-model="item.category" class="field">
                  <option v-for="category in skillCategories" :key="category" :value="category">{{ category }}</option>
                </select>
              </label>
              <label class="field-stack">
                <span class="field-label">Nivel</span>
                <select v-model="item.level" class="field">
                  <option v-for="level in skillLevels" :key="level" :value="level">{{ level }}</option>
                </select>
              </label>
              <label class="field-stack">
                <span class="field-label">Evidencia</span>
                <select v-model="item.evidenceType" class="field">
                  <option v-for="evidence in evidenceTypes" :key="evidence" :value="evidence">{{ evidence }}</option>
                </select>
              </label>
            </div>
            <div class="toolbar" style="margin-top: 16px;">
              <button class="btn btn-primary" type="button" @click="saveSkill(item)">Salvar competencia</button>
              <button class="btn btn-secondary" type="button" @click="profileStore.removeSkill(item.id)">Remover</button>
            </div>
          </article>
        </div>
      </SectionCard>
    </div>
  </div>
</template>
