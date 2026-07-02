import Dexie, { type Table } from 'dexie';
import type {
  ActivityLog,
  AiProviderConfig,
  ApplicationAnswer,
  BinaryAsset,
  Education,
  Experience,
  JobAnalysis,
  JobPost,
  Profile,
  ResumeVersion,
  SearchProfile,
  SearchProviderConfig,
  SearchRun,
  Skill
} from '@/domain/entities/types';

export const DB_NAME = 'applyforge-ai';
export const DB_SCHEMA_VERSION = 1;

export class ApplyForgeDatabase extends Dexie {
  profile!: Table<Profile, string>;
  experiences!: Table<Experience, string>;
  educations!: Table<Education, string>;
  skills!: Table<Skill, string>;
  jobs!: Table<JobPost, string>;
  analyses!: Table<JobAnalysis, string>;
  resumes!: Table<ResumeVersion, string>;
  answers!: Table<ApplicationAnswer, string>;
  searchProfiles!: Table<SearchProfile, string>;
  searchRuns!: Table<SearchRun, string>;
  aiProviders!: Table<AiProviderConfig, string>;
  searchProviders!: Table<SearchProviderConfig, string>;
  logs!: Table<ActivityLog, string>;
  assets!: Table<BinaryAsset, string>;

  constructor() {
    super(DB_NAME);

    this.version(DB_SCHEMA_VERSION).stores({
      profile: 'id, updatedAt',
      experiences: 'id, profileId, sortOrder, updatedAt',
      educations: 'id, profileId, updatedAt',
      skills: 'id, profileId, category, updatedAt',
      jobs: 'id, status, source, searchProfileId, updatedAt, capturedAt',
      analyses: 'id, jobPostId, updatedAt',
      resumes: 'id, jobPostId, profileId, updatedAt',
      answers: 'id, jobPostId, promptKey, updatedAt',
      searchProfiles: 'id, provider, isActive, updatedAt',
      searchRuns: 'id, searchProfileId, status, startedAt, updatedAt',
      aiProviders: 'id, provider, isActive, updatedAt',
      searchProviders: 'id, provider, isActive, updatedAt',
      logs: 'id, type, status, createdAt',
      assets: 'id, kind, createdAt'
    });
  }
}

export const db = new ApplyForgeDatabase();
