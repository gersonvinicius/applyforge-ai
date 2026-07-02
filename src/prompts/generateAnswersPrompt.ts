export const generateAnswersPromptTemplate = `Generate short application-form answers for the vacancy below.

Rules:
- Return valid JSON only.
- Keep the tone natural, direct and professional.
- Use only real candidate data.
- Improve wording when the original profile is too terse, but do not invent facts.
- Create short, medium and long answers for each item.

Expected JSON shape:
{
  "answers": [
    {
      "question": "string",
      "short_answer": "max 250 chars",
      "medium_answer": "max 600 chars",
      "long_answer": "max 1200 chars"
    }
  ]
}

Questions to cover:
- Conte sua experiencia com a stack da vaga
- Experiencia com Scrum/Kanban
- Pretensao salarial
- Disponibilidade
- Por que voce se interessou pela vaga
- Resumo da experiencia mais recente
- Experiencia com APIs REST
- Experiencia com banco de dados
- Experiencia com Docker/Git/CI/CD
- Experiencia com IA no desenvolvimento

Candidate profile:
{{PROFILE_JSON}}

Job post:
{{JOB_JSON}}

Analysis:
{{ANALYSIS_JSON}}`;

export function renderGenerateAnswersPrompt(params: {
  profileJson: unknown;
  jobJson: unknown;
  analysisJson: unknown;
}): string {
  return generateAnswersPromptTemplate
    .replace('{{PROFILE_JSON}}', JSON.stringify(params.profileJson, null, 2))
    .replace('{{JOB_JSON}}', JSON.stringify(params.jobJson, null, 2))
    .replace('{{ANALYSIS_JSON}}', JSON.stringify(params.analysisJson, null, 2));
}
