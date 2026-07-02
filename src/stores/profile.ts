import { defineStore } from 'pinia';
import { db } from '@/db/schema';
import type { BinaryAsset, Education, Experience, Profile, Skill } from '@/domain/entities/types';
import { makeId } from '@/utils/ids';
import { useWorkspaceStore } from '@/stores/workspace';
import type { LinkedInImportMergeSummary } from '@/services/linkedinResumeImport';

interface ProfileState {
  hydrated: boolean;
  isSaving: boolean;
  isClearingProfile: boolean;
  isImportingLinkedinResume: boolean;
  profile: Profile | null;
  experiences: Experience[];
  educations: Education[];
  skills: Skill[];
  linkedinResumeAsset: BinaryAsset | null;
  resumeLayoutAsset: BinaryAsset | null;
}

function nowIso(): string {
  return new Date().toISOString();
}

export const useProfileStore = defineStore('profile', {
  state: (): ProfileState => ({
    hydrated: false,
    isSaving: false,
    isClearingProfile: false,
    isImportingLinkedinResume: false,
    profile: null,
    experiences: [],
    educations: [],
    skills: [],
    linkedinResumeAsset: null,
    resumeLayoutAsset: null
  }),

  actions: {
    async load() {
      const [profile, experiences, educations, skills] = await Promise.all([
        db.profile.toCollection().first().then((value) => value ?? null),
        db.experiences.orderBy('sortOrder').toArray(),
        db.educations.orderBy('updatedAt').reverse().toArray(),
        db.skills.orderBy('updatedAt').reverse().toArray()
      ]);

      const [linkedinResumeAsset, resumeLayoutAsset] = await Promise.all([
        profile?.linkedinResumeAssetId ? db.assets.get(profile.linkedinResumeAssetId) : Promise.resolve(null),
        profile?.resumeLayoutAssetId ? db.assets.get(profile.resumeLayoutAssetId) : Promise.resolve(null)
      ]);

      this.profile = profile;
      this.experiences = experiences;
      this.educations = educations;
      this.skills = skills;
      this.linkedinResumeAsset = linkedinResumeAsset ?? null;
      this.resumeLayoutAsset = resumeLayoutAsset ?? null;
      this.hydrated = true;
    },

    async ensureProfile(): Promise<Profile> {
      if (this.profile) {
        return this.profile;
      }

      const createdAt = nowIso();
      const profile: Profile = {
        id: makeId('profile'),
        createdAt,
        updatedAt: createdAt,
        version: 1,
        fullName: '',
        headline: '',
        phone: '',
        email: '',
        city: '',
        state: '',
        country: 'Brasil',
        linkedinUrl: '',
        githubUrl: '',
        baseSummary: '',
        baseObjective: '',
        targetSeniority: '',
        preferredWorkModel: null,
        salaryExpectation: '',
        resumeTemplate: 'classic',
        linkedinResumeAssetId: null,
        resumeLayoutAssetId: null
      };

      await db.profile.put(profile);
      this.profile = profile;
      await this.syncWorkspace();

      return profile;
    },

    async saveProfile() {
      const profile = await this.ensureProfile();

      this.isSaving = true;

      try {
        profile.updatedAt = nowIso();
        profile.version += 1;
        await db.profile.put(profile);
        this.profile = { ...profile };
        await this.syncWorkspace();
      } finally {
        this.isSaving = false;
      }
    },

    async clearProfileData() {
      const profile = await this.ensureProfile();
      const timestamp = nowIso();
      const assetIds = [profile.linkedinResumeAssetId, profile.resumeLayoutAssetId].filter(Boolean) as string[];

      this.isClearingProfile = true;

      try {
        const clearedProfile: Profile = {
          ...profile,
          fullName: '',
          headline: '',
          phone: '',
          email: '',
          city: '',
          state: '',
          country: 'Brasil',
          linkedinUrl: '',
          githubUrl: '',
          baseSummary: '',
          baseObjective: '',
          targetSeniority: '',
          preferredWorkModel: null,
          salaryExpectation: '',
          resumeTemplate: 'classic',
          linkedinResumeAssetId: null,
          resumeLayoutAssetId: null,
          updatedAt: timestamp,
          version: profile.version + 1
        };

        await db.transaction('rw', db.profile, db.experiences, db.educations, db.skills, db.assets, async () => {
          await db.profile.put(clearedProfile);
          await db.experiences.where('profileId').equals(profile.id).delete();
          await db.educations.where('profileId').equals(profile.id).delete();
          await db.skills.where('profileId').equals(profile.id).delete();

          for (const assetId of assetIds) {
            await db.assets.delete(assetId);
          }
        });

        this.profile = clearedProfile;
        this.experiences = [];
        this.educations = [];
        this.skills = [];
        this.linkedinResumeAsset = null;
        this.resumeLayoutAsset = null;
        await this.syncWorkspace();
      } finally {
        this.isClearingProfile = false;
      }
    },

    async addExperience() {
      const profile = await this.ensureProfile();
      const createdAt = nowIso();
      const experience: Experience = {
        id: makeId('exp'),
        createdAt,
        updatedAt: createdAt,
        version: 1,
        profileId: profile.id,
        company: '',
        role: '',
        startDate: '',
        endDate: '',
        isCurrent: false,
        summary: '',
        activities: [],
        technologies: [],
        highlights: [],
        experienceType: 'real',
        sortOrder: this.experiences.length + 1
      };

      await db.experiences.put(experience);
      this.experiences = [...this.experiences, experience];
      await this.syncWorkspace();
    },

    async saveExperience(experience: Experience) {
      experience.updatedAt = nowIso();
      experience.version += 1;
      await db.experiences.put({ ...experience });
      await this.syncWorkspace();
    },

    async removeExperience(id: string) {
      await db.experiences.delete(id);
      this.experiences = this.experiences.filter((item) => item.id !== id)
        .map((item, index) => ({ ...item, sortOrder: index + 1 }));
      await Promise.all(this.experiences.map((item) => db.experiences.put(item)));
      await this.syncWorkspace();
    },

    async addEducation() {
      const profile = await this.ensureProfile();
      const createdAt = nowIso();
      const education: Education = {
        id: makeId('edu'),
        createdAt,
        updatedAt: createdAt,
        version: 1,
        profileId: profile.id,
        institution: '',
        course: '',
        degreeType: '',
        status: '',
        completionDate: ''
      };

      await db.educations.put(education);
      this.educations = [education, ...this.educations];
      await this.syncWorkspace();
    },

    async saveEducation(education: Education) {
      education.updatedAt = nowIso();
      education.version += 1;
      await db.educations.put({ ...education });
      await this.syncWorkspace();
    },

    async removeEducation(id: string) {
      await db.educations.delete(id);
      this.educations = this.educations.filter((item) => item.id !== id);
      await this.syncWorkspace();
    },

    async addSkill() {
      const profile = await this.ensureProfile();
      const createdAt = nowIso();
      const skill: Skill = {
        id: makeId('skill'),
        createdAt,
        updatedAt: createdAt,
        version: 1,
        profileId: profile.id,
        name: '',
        category: 'backend',
        level: 'intermediate',
        evidenceType: 'real_experience'
      };

      await db.skills.put(skill);
      this.skills = [skill, ...this.skills];
      await this.syncWorkspace();
    },

    async saveSkill(skill: Skill) {
      skill.updatedAt = nowIso();
      skill.version += 1;
      await db.skills.put({ ...skill });
      await this.syncWorkspace();
    },

    async removeSkill(id: string) {
      await db.skills.delete(id);
      this.skills = this.skills.filter((item) => item.id !== id);
      await this.syncWorkspace();
    },

    async setLinkedinResumeAsset(file: File) {
      await this.upsertProfileAsset('linkedinResumeAssetId', 'linkedin_resume_pdf', file);
    },

    async setResumeLayoutAsset(file: File) {
      await this.upsertProfileAsset('resumeLayoutAssetId', 'resume_layout_pdf', file);
    },

    async removeLinkedinResumeAsset() {
      await this.removeProfileAsset('linkedinResumeAssetId');
    },

    async removeResumeLayoutAsset() {
      await this.removeProfileAsset('resumeLayoutAssetId');
    },

    async upsertProfileAsset(
      profileField: 'linkedinResumeAssetId' | 'resumeLayoutAssetId',
      kind: BinaryAsset['kind'],
      file: File
    ) {
      const profile = await this.ensureProfile();
      const currentAssetId = profile[profileField];
      const timestamp = nowIso();
      const asset: BinaryAsset = {
        id: makeId('asset'),
        createdAt: timestamp,
        updatedAt: timestamp,
        version: 1,
        kind,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        blob: file
      };

      profile[profileField] = asset.id;
      profile.updatedAt = timestamp;
      profile.version += 1;

      await db.transaction('rw', db.profile, db.assets, async () => {
        await db.assets.put(asset);
        await db.profile.put({ ...profile });

        if (currentAssetId && currentAssetId !== asset.id) {
          await db.assets.delete(currentAssetId);
        }
      });

      if (profileField === 'linkedinResumeAssetId') {
        this.linkedinResumeAsset = asset;
      } else {
        this.resumeLayoutAsset = asset;
      }

      this.profile = { ...profile };
      await this.syncWorkspace();
    },

    async removeProfileAsset(profileField: 'linkedinResumeAssetId' | 'resumeLayoutAssetId') {
      const profile = await this.ensureProfile();
      const currentAssetId = profile[profileField];

      if (!currentAssetId) {
        return;
      }

      profile[profileField] = null;
      profile.updatedAt = nowIso();
      profile.version += 1;

      await db.transaction('rw', db.profile, db.assets, async () => {
        await db.profile.put({ ...profile });
        await db.assets.delete(currentAssetId);
      });

      if (profileField === 'linkedinResumeAssetId') {
        this.linkedinResumeAsset = null;
      } else {
        this.resumeLayoutAsset = null;
      }

      this.profile = { ...profile };
      await this.syncWorkspace();
    },

    async importLinkedinResumeIntoProfile(): Promise<LinkedInImportMergeSummary> {
      const profile = await this.ensureProfile();
      const assetId = profile.linkedinResumeAssetId;

      if (!assetId) {
        throw new Error('Adicione um PDF do LinkedIn antes de importar no perfil.');
      }

      const asset = await db.assets.get(assetId);

      if (!asset) {
        throw new Error('O PDF do LinkedIn salvo nao foi encontrado no IndexedDB.');
      }

      this.isImportingLinkedinResume = true;

      try {
        const linkedinImport = await import('@/services/linkedinResumeImport');
        const parsed = await linkedinImport.extractLinkedInResumeImport(asset);
        const merged = await linkedinImport.mergeLinkedInImportIntoProfile({
          profile,
          existingExperiences: this.experiences,
          existingEducations: this.educations,
          existingSkills: this.skills,
          parsed
        });

        await db.transaction('rw', db.profile, db.experiences, db.educations, db.skills, db.logs, async () => {
          await db.profile.put(merged.profile);
          await db.experiences.where('profileId').equals(profile.id).delete();
          await db.educations.where('profileId').equals(profile.id).delete();
          await db.skills.where('profileId').equals(profile.id).delete();

          if (merged.experiencesToAdd.length > 0) {
            await db.experiences.bulkPut(merged.experiencesToAdd);
          }

          if (merged.educationsToAdd.length > 0) {
            await db.educations.bulkPut(merged.educationsToAdd);
          }

          if (merged.skillsToAdd.length > 0) {
            await db.skills.bulkPut(merged.skillsToAdd);
          }

          await db.logs.put({
            id: makeId('log'),
            createdAt: merged.summary.importedAt,
            updatedAt: merged.summary.importedAt,
            version: 1,
            type: 'profile_import',
            status: 'success',
            message: 'PDF do LinkedIn importado e mesclado ao perfil local.',
            contextJson: JSON.stringify(merged.summary)
          });
        });

        await this.load();
        await this.syncWorkspace();

        return merged.summary;
      } catch (error) {
        const timestamp = nowIso();
        const message = error instanceof Error ? error.message : 'Falha ao importar PDF do LinkedIn.';

        await db.logs.put({
          id: makeId('log'),
          createdAt: timestamp,
          updatedAt: timestamp,
          version: 1,
          type: 'error',
          status: 'error',
          message: `Falha na importacao do LinkedIn PDF: ${message}`,
          contextJson: JSON.stringify({ profileId: profile.id })
        });

        throw error;
      } finally {
        this.isImportingLinkedinResume = false;
      }
    },

    async syncWorkspace() {
      const workspace = useWorkspaceStore();
      await workspace.bootstrap();
    }
  }
});
