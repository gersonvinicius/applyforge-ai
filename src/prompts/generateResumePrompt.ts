export const generateResumePromptTemplate = `Generate a tailored resume payload for the vacancy below.

Rules:
- Use only real data from the candidate profile.
- The profile may include metadata about a LinkedIn resume PDF attached by the user. Use it only as a supporting factual hint when available.
- You may improve the wording of simplified or poorly written profile experiences so they become clearer, more professional and easier for a recruiter to read, but do not add facts that are not supported by the profile.
- If layout reference guidance is available, preserve its section logic, hierarchy and overall density as closely as possible.
- The final resume must adapt strongly to the vacancy: prioritize the most relevant experiences, stack, keywords and differentiators for that specific job.
- For key_skills, return many short items suitable for a compact matrix when the profile supports it.
- For each experience, keep the summary compact, recruiter-friendly and informative.
- If the raw experience text is too basic, rewrite it with better verbs, stronger clarity and better technical framing while preserving the real scope of work.
- Prefer concise reading rhythm: usually 1 short summary plus 2-4 highlights per experience.
- You may reorder and reposition genuine skills.
- If a skill is complementary knowledge, make that clear without overselling.
- If the candidate has little experience, emphasize transferable skills, education, projects and clarity instead of inventing seniority.
- Return valid JSON only.
- Keep the resume ATS-friendly and concise.

Expected JSON shape:
{
  "title": "string",
  "recommended_resume_title": "string",
  "recommended_file_name": "string",
  "positioning": "string",
  "base_technical_stack": ["string"],
  "immediate_differentiator": "string",
  "summary": "string",
  "key_skills": ["string"],
  "experiences": [
    {
      "company": "string",
      "role": "string",
      "period": "string",
      "summary": "string",
      "highlights": ["string"]
    }
  ],
  "education": [
    {
      "institution": "string",
      "course": "string",
      "details": "string"
    }
  ],
  "objective": "string"
}

Candidate profile:
{{PROFILE_JSON}}

Supporting LinkedIn resume text:
{{LINKEDIN_RESUME_TEXT}}

Job post:
{{JOB_JSON}}

Analysis:
{{ANALYSIS_JSON}}

Preferred resume template:
{{RESUME_TEMPLATE}}

Layout reference guidance:
{{LAYOUT_REFERENCE_GUIDANCE}}`;

export function renderGenerateResumePrompt(params: {
  profileJson: unknown;
  linkedinResumeText: string;
  jobJson: unknown;
  analysisJson: unknown;
  resumeTemplate: string;
  layoutReferenceGuidance: string;
}): string {
  return generateResumePromptTemplate
    .replace('{{PROFILE_JSON}}', JSON.stringify(params.profileJson, null, 2))
    .replace('{{LINKEDIN_RESUME_TEXT}}', params.linkedinResumeText)
    .replace('{{JOB_JSON}}', JSON.stringify(params.jobJson, null, 2))
    .replace('{{ANALYSIS_JSON}}', JSON.stringify(params.analysisJson, null, 2))
    .replace('{{RESUME_TEMPLATE}}', params.resumeTemplate)
    .replace('{{LAYOUT_REFERENCE_GUIDANCE}}', params.layoutReferenceGuidance);
}
