export const analyzeJobPromptTemplate = `Analyze the job below and compare it only against the candidate's real profile.

Rules:
- Return valid JSON only.
- Do not invent experience.
- Distinguish real experience from complementary knowledge.
- Keep language concise and professional.
- Use the supporting LinkedIn resume text only to confirm or enrich real facts already consistent with the profile.

Expected JSON shape:
{
  "job_title": "string",
  "company": "string",
  "seniority": "string",
  "work_model": "string",
  "required_skills": ["string"],
  "desired_skills": ["string"],
  "responsibilities": ["string"],
  "keywords": ["string"],
  "risks": ["string"],
  "fit_score": 0,
  "fit_level": "strong|medium|low|aggressive",
  "fit_summary": "string",
  "missing_requirements": ["string"],
  "suggested_positioning": "string",
  "recommended_resume_title": "string",
  "recommended_file_name": "string"
}

Candidate profile:
{{PROFILE_JSON}}

Supporting LinkedIn resume text:
{{LINKEDIN_RESUME_TEXT}}

Job post:
{{JOB_JSON}}`;

export function renderAnalyzeJobPrompt(params: {
  profileJson: unknown;
  linkedinResumeText?: string | null;
  jobJson: unknown;
}): string {
  return analyzeJobPromptTemplate
    .replace('{{PROFILE_JSON}}', JSON.stringify(params.profileJson, null, 2))
    .replace('{{LINKEDIN_RESUME_TEXT}}', params.linkedinResumeText?.trim() || 'N/A')
    .replace('{{JOB_JSON}}', JSON.stringify(params.jobJson, null, 2));
}
