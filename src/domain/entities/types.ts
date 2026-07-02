export type WorkModel = 'remote' | 'hybrid' | 'onsite' | null;
export type JobStatus =
  | 'new'
  | 'analyzed'
  | 'resume_generated'
  | 'ready_to_send'
  | 'sent_manual'
  | 'interview'
  | 'rejected'
  | 'archived';

export interface EntityBase {
  id: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface Profile extends EntityBase {
  fullName: string;
  headline: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  country: string;
  linkedinUrl: string;
  githubUrl: string;
  baseSummary: string;
  baseObjective: string;
  targetSeniority: string;
  preferredWorkModel: WorkModel;
  salaryExpectation: string;
  resumeTemplate: 'classic' | 'compact' | 'reference_pdf';
  linkedinResumeAssetId: string | null;
  resumeLayoutAssetId: string | null;
}

export interface Experience extends EntityBase {
  profileId: string;
  company: string;
  role: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  summary: string;
  activities: string[];
  technologies: string[];
  highlights: string[];
  experienceType: 'real' | 'complementary' | 'personal_project';
  sortOrder: number;
}

export interface Education extends EntityBase {
  profileId: string;
  institution: string;
  course: string;
  degreeType: string;
  status: string;
  completionDate: string;
}

export interface Skill extends EntityBase {
  profileId: string;
  name: string;
  category: 'backend' | 'frontend' | 'database' | 'cloud' | 'devops' | 'ai' | 'architecture' | 'tests' | 'soft_skill';
  level: 'basic' | 'intermediate' | 'advanced';
  evidenceType: 'real_experience' | 'complementary_knowledge' | 'studying';
}

export interface JobPost extends EntityBase {
  title: string;
  company: string;
  location: string;
  workModel: WorkModel;
  seniority: string;
  source: 'manual' | 'rss' | 'public_api' | 'search_web';
  originalUrl: string;
  description: string;
  status: JobStatus;
  capturedAt: string;
  appliedAt: string | null;
  notes: string;
  searchProfileId: string | null;
}

export interface JobAnalysis extends EntityBase {
  jobPostId: string;
  provider: string;
  model: string;
  fitScore: number | null;
  fitLabel: string;
  fitSummary: string;
  requiredSkills: string[];
  desiredSkills: string[];
  responsibilities: string[];
  keywords: string[];
  risks: string[];
  missingRequirements: string[];
  suggestedPositioning: string;
  recommendedResumeTitle: string;
  recommendedFileName: string;
  rawJson: string;
  estimatedCostUsd: number | null;
}

export interface ResumeVersion extends EntityBase {
  jobPostId: string;
  profileId: string;
  provider: string;
  model: string;
  title: string;
  fileName: string;
  htmlSnapshot: string;
  pdfAssetId: string | null;
  estimatedCostUsd: number | null;
}

export interface ApplicationAnswer extends EntityBase {
  jobPostId: string;
  provider: string;
  model: string;
  question: string;
  promptKey: string;
  sortOrder: number;
  shortVersion: string;
  mediumVersion: string;
  longVersion: string;
  estimatedCostUsd: number | null;
}

export interface SearchProfile extends EntityBase {
  name: string;
  keywords: string;
  location: string;
  workModel: WorkModel;
  seniority: string;
  provider: 'rss' | 'adzuna';
  sourceType: 'rss' | 'api';
  countryCode: string;
  postedWithin: '' | '24h' | '7d' | '30d';
  applicationType: '' | 'simplified';
  sourceUrl: string;
  targetDomains: string[];
  frequency: 'manual';
  isActive: boolean;
  notes: string;
  lastRanAt: string | null;
}

export interface SearchRun extends EntityBase {
  searchProfileId: string;
  status: 'running' | 'completed' | 'failed';
  summary: string;
  foundCount: number;
  startedAt: string;
  finishedAt: string | null;
  contextJson: string;
}

export interface AiProviderConfig extends EntityBase {
  provider: 'openrouter';
  apiKey: string;
  baseUrl: string;
  defaultModel: string;
  temperature: number;
  maxTokens: number;
  isActive: boolean;
}

export interface SearchProviderConfig extends EntityBase {
  provider: 'rss' | 'adzuna';
  credentialsJson: string;
  baseUrl: string;
  isActive: boolean;
}

export interface ActivityLog extends EntityBase {
  type: 'job_import' | 'job_analysis' | 'answer_generation' | 'resume_generation' | 'pdf_generation' | 'profile_import' | 'error' | 'token_cost' | 'status_change' | 'backup';
  status: 'info' | 'success' | 'warning' | 'error';
  message: string;
  contextJson: string;
}

export interface BinaryAsset extends EntityBase {
  kind: 'linkedin_resume_pdf' | 'resume_layout_pdf' | 'generated_resume_pdf';
  fileName: string;
  mimeType: string;
  size: number;
  blob: Blob;
}

export interface BinaryAssetSnapshot extends Omit<BinaryAsset, 'blob'> {
  blobDataUrl: string;
}

export interface WorkspaceSnapshot {
  schemaVersion: number;
  exportedAt: string;
  profile: Profile | null;
  experiences: Experience[];
  educations: Education[];
  skills: Skill[];
  jobs: JobPost[];
  analyses: JobAnalysis[];
  resumes: ResumeVersion[];
  answers: ApplicationAnswer[];
  searchProfiles: SearchProfile[];
  searchRuns: SearchRun[];
  aiProviders: AiProviderConfig[];
  searchProviders: SearchProviderConfig[];
  logs: ActivityLog[];
  assets: BinaryAssetSnapshot[];
}
