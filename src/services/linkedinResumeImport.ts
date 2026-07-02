import { db } from '@/db/schema';
import type { BinaryAsset, Education, Experience, Profile, Skill } from '@/domain/entities/types';
import { runOpenRouterJsonPrompt } from '@/services/openRouter';
import { extractPdfText } from '@/services/pdfText';
import { makeId } from '@/utils/ids';

interface ImportedExperienceInput {
  company: string;
  role: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  summary: string;
  activities: string[];
  technologies: string[];
  highlights: string[];
}

interface ImportedEducationInput {
  institution: string;
  course: string;
  degreeType: string;
  status: string;
  completionDate: string;
}

interface ImportedSkillInput {
  name: string;
  category: Skill['category'];
  level: Skill['level'];
  evidenceType: Skill['evidenceType'];
}

export interface LinkedInResumeImportResult {
  rawText: string;
  profilePatch: Partial<Profile>;
  experiences: ImportedExperienceInput[];
  educations: ImportedEducationInput[];
  skills: ImportedSkillInput[];
}

interface LinkedInImportAiEnvelope {
  baseObjective?: string;
  experiences?: Array<{
    company?: string;
    role?: string;
    startDate?: string;
    summary?: string;
    activities?: string[];
    highlights?: string[];
    technologies?: string[];
  }>;
}

const monthMap = new Map<string, string>([
  ['jan', '01'],
  ['january', '01'],
  ['janeiro', '01'],
  ['fev', '02'],
  ['feb', '02'],
  ['february', '02'],
  ['fevereiro', '02'],
  ['mar', '03'],
  ['march', '03'],
  ['marco', '03'],
  ['março', '03'],
  ['abr', '04'],
  ['apr', '04'],
  ['april', '04'],
  ['abril', '04'],
  ['mai', '05'],
  ['may', '05'],
  ['maio', '05'],
  ['jun', '06'],
  ['june', '06'],
  ['junho', '06'],
  ['jul', '07'],
  ['july', '07'],
  ['julho', '07'],
  ['ago', '08'],
  ['aug', '08'],
  ['august', '08'],
  ['agosto', '08'],
  ['set', '09'],
  ['sep', '09'],
  ['september', '09'],
  ['setembro', '09'],
  ['out', '10'],
  ['oct', '10'],
  ['october', '10'],
  ['outubro', '10'],
  ['nov', '11'],
  ['november', '11'],
  ['novembro', '11'],
  ['dez', '12'],
  ['dec', '12'],
  ['december', '12'],
  ['dezembro', '12']
]);

const techDictionary: Array<{ name: string; category: Skill['category']; patterns: RegExp[] }> = [
  { name: 'PHP', category: 'backend', patterns: [/\bphp\b/i] },
  { name: 'Laravel', category: 'backend', patterns: [/\blaravel\b/i] },
  { name: 'Symfony', category: 'backend', patterns: [/\bsymfony\b/i] },
  { name: 'Node.js', category: 'backend', patterns: [/\bnode\.?js\b/i] },
  { name: 'NestJS', category: 'backend', patterns: [/\bnest\.?js\b/i] },
  { name: 'TypeScript', category: 'frontend', patterns: [/\btypescript\b/i] },
  { name: 'JavaScript', category: 'frontend', patterns: [/\bjavascript\b/i] },
  { name: 'React', category: 'frontend', patterns: [/\breact\b/i] },
  { name: 'Next.js', category: 'frontend', patterns: [/\bnext\.?js\b/i] },
  { name: 'Vue.js', category: 'frontend', patterns: [/\bvue\.?js\b|\bvue\b/i] },
  { name: 'Angular', category: 'frontend', patterns: [/\bangular\b/i] },
  { name: 'MySQL', category: 'database', patterns: [/\bmysql\b/i] },
  { name: 'PostgreSQL', category: 'database', patterns: [/\bpostgres(?:ql)?\b/i] },
  { name: 'SQL Server', category: 'database', patterns: [/\bsql server\b/i] },
  { name: 'MongoDB', category: 'database', patterns: [/\bmongodb\b/i] },
  { name: 'Redis', category: 'database', patterns: [/\bredis\b/i] },
  { name: 'Docker', category: 'devops', patterns: [/\bdocker\b/i] },
  { name: 'Kubernetes', category: 'devops', patterns: [/\bkubernetes\b|\bk8s\b/i] },
  { name: 'Git', category: 'devops', patterns: [/\bgit\b/i] },
  { name: 'Bitbucket', category: 'devops', patterns: [/\bbitbucket\b/i] },
  { name: 'GitLab', category: 'devops', patterns: [/\bgitlab\b/i] },
  { name: 'Jenkins', category: 'devops', patterns: [/\bjenkins\b/i] },
  { name: 'CI/CD', category: 'devops', patterns: [/\bci\/cd\b|\bcontinuous integration\b|\bcontinuous delivery\b/i] },
  { name: 'AWS', category: 'cloud', patterns: [/\baws\b|\bamazon web services\b/i] },
  { name: 'Azure', category: 'cloud', patterns: [/\bazure\b/i] },
  { name: 'GCP', category: 'cloud', patterns: [/\bgcp\b|\bgoogle cloud\b/i] },
  { name: 'C#', category: 'backend', patterns: [/\bc#\b/i] },
  { name: '.NET', category: 'backend', patterns: [/\b\.net\b|\bdotnet\b|\bnet core\b/i] },
  { name: 'Classic ASP', category: 'backend', patterns: [/\bclassic asp\b/i] },
  { name: 'Python', category: 'backend', patterns: [/\bpython\b/i] },
  { name: 'Java', category: 'backend', patterns: [/\bjava\b/i] },
  { name: 'Oracle', category: 'database', patterns: [/\boracle\b/i] },
  { name: 'Magento 2', category: 'backend', patterns: [/\bmagento 2\b/i] },
  { name: 'REST API', category: 'architecture', patterns: [/\brest\b|\bapi(?:s)?\b/i] },
  { name: 'GraphQL', category: 'architecture', patterns: [/\bgraphql\b/i] },
  { name: 'SOLID', category: 'architecture', patterns: [/\bsolid\b/i] },
  { name: 'Clean Code', category: 'architecture', patterns: [/\bclean code\b/i] },
  { name: 'Linux', category: 'devops', patterns: [/\blinux\b/i] },
  { name: 'Scrum', category: 'soft_skill', patterns: [/\bscrum\b/i] },
  { name: 'Kanban', category: 'soft_skill', patterns: [/\bkanban\b/i] },
  { name: 'Jira', category: 'soft_skill', patterns: [/\bjira\b/i] },
  { name: 'Slack', category: 'soft_skill', patterns: [/\bslack\b/i] }
];

const sectionHeadings: Record<string, string[]> = {
  summary: ['about', 'sobre', 'summary', 'resumo'],
  experiences: ['experience', 'experiencias', 'experiências', 'experiencia', 'experiência'],
  education: ['education', 'educacao', 'educação', 'formacao', 'formação', 'formacao academica', 'formação acadêmica'],
  skills: ['skills', 'top skills', 'principais competencias', 'competencias', 'competências', 'habilidades']
};

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeHeading(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeLines(rawText: string): string[] {
  return rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)
    .filter((line) => !/^page\s+\d+\s+of\s+\d+$/i.test(line))
    .filter((line) => !/^save to pdf from linkedin$/i.test(line));
}

function compactUrl(rawText: string): string {
  return rawText
    .replace(/\s+/g, '')
    .replace(/\((LinkedIn|GitHub)\)/gi, '')
    .trim();
}

function isSectionHeading(line: string): string | null {
  const normalized = normalizeHeading(line);

  for (const [key, values] of Object.entries(sectionHeadings)) {
    if (values.includes(normalized)) {
      return key;
    }
  }

  return null;
}

function splitSections(lines: string[]): Record<string, string[]> {
  const sections: Record<string, string[]> = {
    header: [],
    summary: [],
    experiences: [],
    education: [],
    skills: []
  };

  let current: keyof typeof sections = 'header';

  for (const line of lines) {
    const heading = isSectionHeading(line);

    if (heading && heading in sections) {
      current = heading as keyof typeof sections;
      continue;
    }

    sections[current].push(line);
  }

  return sections;
}

function looksLikeName(line: string): boolean {
  if (/[0-9@|:/]/.test(line)) {
    return false;
  }

  if (isSectionHeading(line)) {
    return false;
  }

  const words = line.split(' ').filter(Boolean);

  if (words.length < 2 || words.length > 5) {
    return false;
  }

  return words.every((word) => /^[A-ZÀ-Ý][A-Za-zÀ-ÿ'-]+$/.test(word));
}

function detectName(lines: string[]): string {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const next = lines[index + 1] ?? '';

    if (!looksLikeName(line)) {
      continue;
    }

    if (next.includes('|') || /\bdesenvolvedor\b|\bdeveloper\b|\banalista\b|\bengineer\b/i.test(next)) {
      return line;
    }
  }

  return lines.find((line) => looksLikeName(line)) ?? '';
}

function detectHeadline(lines: string[], fullName: string): string {
  const nameIndex = lines.findIndex((line) => line === fullName);

  if (nameIndex === -1) {
    return '';
  }

  const parts: string[] = [];

  for (let index = nameIndex + 1; index < Math.min(lines.length, nameIndex + 4); index += 1) {
    const line = lines[index];

    if (line === '' || isSectionHeading(line) || looksLikeName(line)) {
      break;
    }

    if (/^brasil$|^portugal$/i.test(line)) {
      continue;
    }

    parts.push(line);
  }

  return normalizeWhitespace(parts.join(' '));
}

function detectEmail(rawText: string): string {
  return rawText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? '';
}

function detectPhone(rawText: string): string {
  return rawText.match(/(?:\+\d{1,3}\s*)?(?:\(?\d{2,3}\)?\s*)?(?:\d[\s.-]*){8,14}\d/)?.[0]?.trim() ?? '';
}

function detectUrl(rawText: string, kind: 'linkedin' | 'github'): string {
  const compact = compactUrl(rawText);
  const pattern = kind === 'linkedin'
    ? /(?:https?:\/\/)?(?:[\w.-]+\.)?linkedin\.com\/[^\s)]+/i
    : /(?:https?:\/\/)?(?:[\w.-]+\.)?github\.com\/[^\s)]+/i;

  const matched = compact.match(pattern)?.[0] ?? '';

  if (matched === '') {
    return '';
  }

  return matched.startsWith('http') ? matched : `https://${matched}`;
}

function detectLocation(headerLines: string[]): { city: string; state: string; country: string } {
  const locationLine = headerLines.find((line) =>
    !/[0-9@]/.test(line) &&
    !/^https?:\/\//i.test(line) &&
    !looksLikeName(line) &&
    (line.includes(',') || line.includes('/') || /\bbrasil\b|\bportugal\b/i.test(line))
  ) ?? '';

  if (locationLine === '') {
    return { city: '', state: '', country: '' };
  }

  const slashDashMatch = locationLine.match(/^(.+?)\/([A-Za-z]{2})\s*-\s*(.+)$/);

  if (slashDashMatch) {
    return {
      city: normalizeWhitespace(slashDashMatch[1]),
      state: normalizeWhitespace(slashDashMatch[2]).toUpperCase(),
      country: normalizeWhitespace(slashDashMatch[3])
    };
  }

  const parts = locationLine.split(',').map((item) => item.trim()).filter(Boolean);

  return {
    city: parts[0] ?? '',
    state: parts[1] ?? '',
    country: parts[2] ?? (/\bbrasil\b/i.test(locationLine) ? 'Brasil' : /\bportugal\b/i.test(locationLine) ? 'Portugal' : '')
  };
}

function toIsoMonth(year: string, monthToken?: string): string {
  const month = monthToken ? monthMap.get(normalizeHeading(monthToken)) ?? '01' : '01';
  return `${year}-${month}`;
}

function parseDateRange(line: string): { startDate: string; endDate: string; isCurrent: boolean } {
  const normalized = line
    .replace(/\u2013|\u2014/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  const monthMatches = [...normalized.matchAll(/\b([A-Za-zÀ-ÿ]{3,})(?:\s+de)?\s+((?:19|20)\d{2})/g)];
  const yearOnlyMatches = [...normalized.matchAll(/\b((?:19|20)\d{2})\b/g)];
  const isCurrent = /present|atual|momento/i.test(normalized);

  if (monthMatches.length > 0) {
    const first = monthMatches[0];
    const last = monthMatches.at(-1) ?? first;

    return {
      startDate: toIsoMonth(first[2], first[1]),
      endDate: isCurrent ? '' : toIsoMonth(last[2], last[1]),
      isCurrent
    };
  }

  if (yearOnlyMatches.length > 0) {
    const firstYear = yearOnlyMatches[0][1];
    const lastYear = yearOnlyMatches.at(-1)?.[1] ?? firstYear;

    return {
      startDate: `${firstYear}-01`,
      endDate: isCurrent ? '' : `${lastYear}-01`,
      isCurrent
    };
  }

  return { startDate: '', endDate: '', isCurrent };
}

function isDateRangeLine(line: string): boolean {
  return /(?:19|20)\d{2}/.test(line) && /-|present|atual|momento|até|to|de/i.test(line);
}

function cleanDetailLine(line: string): string {
  return normalizeWhitespace(line)
    .replace(/^[-•]\s*/, '')
    .replace(/\s+\(\d+\s+meses?\)$/i, '')
    .trim();
}

function looksLikeLocationLine(line: string): boolean {
  return /\bbrasil\b|\bportugal\b/i.test(line) || /,\s*[A-Za-zÀ-ÿ\s]+$/.test(line);
}

function looksLikeExperienceStart(lines: string[], index: number): boolean {
  return index + 2 < lines.length
    && !isSectionHeading(lines[index])
    && !isDateRangeLine(lines[index])
    && !isDateRangeLine(lines[index + 1])
    && isDateRangeLine(lines[index + 2]);
}

function looksLikeEducationStart(lines: string[], index: number): boolean {
  const current = normalizeWhitespace(lines[index] ?? '');

  if (
    current === '' ||
    isSectionHeading(current) ||
    isDateRangeLine(current) ||
    /^[·•(-]/.test(current) ||
    looksLikeLocationLine(current)
  ) {
    return false;
  }

  const forwardWindow = lines
    .slice(index + 1, index + 5)
    .map((line) => normalizeWhitespace(line))
    .join(' ');

  return /(?:19|20)\d{2}/.test(forwardWindow);
}

function detectTechnologies(text: string): ImportedSkillInput[] {
  return techDictionary
    .filter((item) => item.patterns.some((pattern) => pattern.test(text)))
    .map((item) => ({
      name: item.name,
      category: item.category,
      level: 'intermediate' as const,
      evidenceType: 'real_experience' as const
    }));
}

function summarizeExperience(detailLines: string[]): string {
  return normalizeWhitespace(detailLines.join(' '))
    .replace(/\s+([,.])/g, '$1')
    .trim();
}

function buildActivities(detailLines: string[]): string[] {
  return detailLines
    .map((line) => cleanDetailLine(line))
    .filter((line) => line.length >= 18)
    .slice(0, 4);
}

function buildHighlights(detailLines: string[]): string[] {
  const chunks = detailLines
    .flatMap((line) => cleanDetailLine(line).split(/[.;]/))
    .map((item) => normalizeWhitespace(item))
    .filter((item) => item.length >= 24);

  return [...new Set(chunks)].slice(0, 3);
}

function parseExperiences(lines: string[]): ImportedExperienceInput[] {
  const experiences: ImportedExperienceInput[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    if (!looksLikeExperienceStart(lines, index)) {
      continue;
    }

    const company = normalizeWhitespace(lines[index] ?? '');
    const role = normalizeWhitespace(lines[index + 1] ?? '');
    const dateLine = normalizeWhitespace(lines[index + 2] ?? '');

    if (company === '' || role === '') {
      continue;
    }

    let cursor = index + 3;

    if (looksLikeLocationLine(lines[cursor] ?? '')) {
      cursor += 1;
    }

    const detailLines: string[] = [];

    while (cursor < lines.length && !isSectionHeading(lines[cursor]) && !looksLikeExperienceStart(lines, cursor)) {
      detailLines.push(cleanDetailLine(lines[cursor]));
      cursor += 1;
    }

    const parsedRange = parseDateRange(dateLine);
    const summary = summarizeExperience(detailLines);
    const technologies = detectTechnologies([company, role, summary].join(' '))
      .map((item) => item.name)
      .slice(0, 8);

    experiences.push({
      company,
      role,
      startDate: parsedRange.startDate,
      endDate: parsedRange.endDate,
      isCurrent: parsedRange.isCurrent,
      summary,
      activities: buildActivities(detailLines),
      technologies,
      highlights: buildHighlights(detailLines)
    });

    index = cursor - 1;
  }

  const signatures = new Set<string>();

  return experiences.filter((item) => {
    const signature = normalizeHeading(`${item.company}|${item.role}|${item.startDate}`);

    if (signature === '' || signatures.has(signature)) {
      return false;
    }

    signatures.add(signature);
    return true;
  });
}

function inferDegreeType(course: string): string {
  const normalized = normalizeHeading(course);

  if (/\bpos graduacao\b|\bespecializacao\b/.test(normalized)) {
    return 'Pós-graduação';
  }

  if (/\bmba\b/.test(normalized)) {
    return 'MBA';
  }

  if (/\bmestrado\b/.test(normalized)) {
    return 'Mestrado';
  }

  if (/\bdoutorado\b/.test(normalized)) {
    return 'Doutorado';
  }

  if (/\bgraduacao\b|\bbacharel\b|\bsistemas de informacao\b|\btecnologia da informacao\b/.test(normalized)) {
    return 'Graduação';
  }

  return '';
}

function parseEducation(lines: string[]): ImportedEducationInput[] {
  const entries: ImportedEducationInput[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    if (!looksLikeEducationStart(lines, index)) {
      continue;
    }

    const institution = normalizeWhitespace(lines[index] ?? '');
    let cursor = index + 1;
    const detailLines: string[] = [];

    while (cursor < lines.length && !isSectionHeading(lines[cursor]) && !looksLikeEducationStart(lines, cursor)) {
      detailLines.push(normalizeWhitespace(lines[cursor]));
      cursor += 1;
    }

    const joined = normalizeWhitespace(detailLines.join(' '));

    if (joined === '' || !/(?:19|20)\d{2}/.test(joined)) {
      index = cursor - 1;
      continue;
    }

    const [coursePart, ...dateParts] = joined.split('·');
    const course = normalizeWhitespace(coursePart.replace(/\(\s*$/g, ''));
    const dateSource = normalizeWhitespace(dateParts.join(' ')) || joined;
    const parsedRange = parseDateRange(dateSource);
    const completionDate = parsedRange.isCurrent ? '' : parsedRange.endDate || parsedRange.startDate;

    entries.push({
      institution,
      course,
      degreeType: inferDegreeType(course),
      status: parsedRange.isCurrent ? 'cursando' : 'concluido',
      completionDate
    });

    index = cursor - 1;
  }

  return entries;
}

function shouldIgnoreSkillLine(line: string, fullName: string, headline: string): boolean {
  const normalized = normalizeHeading(line);

  return normalized === ''
    || normalized === normalizeHeading(fullName)
    || normalized === normalizeHeading(headline)
    || normalized === 'brasil'
    || normalized === 'portugal'
    || normalized === 'contato'
    || /\bcertificate\b|\bcertifications\b/.test(normalized)
    || looksLikeLocationLine(line)
    || looksLikeName(line)
    || line.includes('|');
}

function parseSkills(lines: string[], rawText: string, fullName: string, headline: string): ImportedSkillInput[] {
  const explicit = lines
    .filter((line) => !shouldIgnoreSkillLine(line, fullName, headline))
    .flatMap((line) => line.split(/[,|•]/))
    .map((item) => normalizeWhitespace(item))
    .filter((item) => item.length >= 2 && item.length <= 32)
    .map((name) => {
      const detected = detectTechnologies(name).at(0);

      return {
        name,
        category: detected?.category ?? 'soft_skill',
        level: 'intermediate' as const,
        evidenceType: 'real_experience' as const
      };
    });

  const inferred = detectTechnologies(rawText);
  const merged = [...explicit, ...inferred];
  const seen = new Set<string>();

  return merged.filter((item) => {
    const signature = normalizeHeading(item.name);

    if (signature === '' || seen.has(signature)) {
      return false;
    }

    seen.add(signature);
    return true;
  }).slice(0, 14);
}

function inferBaseObjective(summary: string, headline: string): string {
  const normalizedSummary = normalizeWhitespace(summary);
  const directMatch = normalizedSummary.match(/busco\s+oportunidades?.*?(?:\.|$)/i);

  if (directMatch?.[0]) {
    return normalizeWhitespace(directMatch[0]);
  }

  if (headline.trim() !== '') {
    return `Atuar em oportunidades aderentes a ${headline.trim()}, contribuindo com manutencao, evolucao e entrega tecnica de produtos digitais.`;
  }

  return '';
}

async function enrichExperiencesWithAi(parsed: LinkedInResumeImportResult): Promise<LinkedInResumeImportResult> {
  const provider = await db.aiProviders.toCollection().first();

  if (!provider || !provider.isActive || provider.apiKey.trim() === '' || parsed.experiences.length === 0) {
    return parsed;
  }

  const prompt = [
    'Voce vai melhorar dados importados de um curriculo do LinkedIn.',
    'Regras:',
    '- Nao invente fatos, datas, empresas, tecnologias ou resultados.',
    '- Apenas reescreva com linguagem mais clara e profissional.',
    '- summary: 1 paragrafo curto.',
    '- activities: 2 a 4 itens objetivos.',
    '- highlights: 1 a 3 itens de maior impacto.',
    '- technologies: somente tecnologias citadas ou claramente inferiveis do texto factual.',
    '- baseObjective: crie um objetivo profissional curto e realista.',
    '- Responda somente JSON.',
    JSON.stringify({
      headline: parsed.profilePatch.headline ?? '',
      baseSummary: parsed.profilePatch.baseSummary ?? '',
      experiences: parsed.experiences
    })
  ].join('\n');

  try {
    const response = await runOpenRouterJsonPrompt(provider, prompt);
    const payload = JSON.parse(response.content) as LinkedInImportAiEnvelope;
    const bySignature = new Map(
      (payload.experiences ?? []).map((item) => [
        normalizeHeading(`${item.company ?? ''}|${item.role ?? ''}|${item.startDate ?? ''}`),
        item
      ])
    );

    return {
      ...parsed,
      profilePatch: {
        ...parsed.profilePatch,
        baseObjective: normalizeWhitespace(String(payload.baseObjective ?? '')) || String(parsed.profilePatch.baseObjective ?? '')
      },
      experiences: parsed.experiences.map((experience) => {
        const enriched = bySignature.get(normalizeHeading(`${experience.company}|${experience.role}|${experience.startDate}`));

        if (!enriched) {
          return experience;
        }

        return {
          ...experience,
          summary: normalizeWhitespace(String(enriched.summary ?? '')) || experience.summary,
          activities: Array.isArray(enriched.activities)
            ? enriched.activities.map((item) => normalizeWhitespace(String(item))).filter(Boolean).slice(0, 4)
            : experience.activities,
          highlights: Array.isArray(enriched.highlights)
            ? enriched.highlights.map((item) => normalizeWhitespace(String(item))).filter(Boolean).slice(0, 3)
            : experience.highlights,
          technologies: Array.isArray(enriched.technologies)
            ? [...new Set(enriched.technologies.map((item) => normalizeWhitespace(String(item))).filter(Boolean))].slice(0, 8)
            : experience.technologies
        };
      })
    };
  } catch {
    return parsed;
  }
}

export async function extractLinkedInResumeImport(asset: BinaryAsset): Promise<LinkedInResumeImportResult> {
  const rawText = await extractPdfText(asset.blob);
  const lines = normalizeLines(rawText);
  const sections = splitSections(lines);
  const fullName = detectName(lines);
  const headline = detectHeadline(lines, fullName);
  const location = detectLocation(sections.header);
  const summary = normalizeWhitespace(sections.summary.join(' '));

  const parsed: LinkedInResumeImportResult = {
    rawText,
    profilePatch: {
      fullName,
      headline,
      email: detectEmail(rawText),
      phone: detectPhone(rawText),
      city: location.city,
      state: location.state,
      country: location.country,
      linkedinUrl: detectUrl(rawText, 'linkedin'),
      githubUrl: detectUrl(rawText, 'github'),
      baseSummary: summary,
      baseObjective: inferBaseObjective(summary, headline)
    },
    experiences: parseExperiences(sections.experiences),
    educations: parseEducation(sections.education),
    skills: parseSkills(sections.skills, rawText, fullName, headline)
  };

  return enrichExperiencesWithAi(parsed);
}

export interface LinkedInImportMergeSummary {
  importedAt: string;
  fullNameFilled: boolean;
  headlineFilled: boolean;
  summaryFilled: boolean;
  objectiveFilled: boolean;
  experiencesAdded: number;
  educationsAdded: number;
  skillsAdded: number;
}

function normalizeProfileValue(current: string, incoming: string): [string, boolean] {
  const next = normalizeWhitespace(incoming) !== '' ? incoming : current;
  return [next, next !== current];
}

function inferSkillCategory(name: string): Skill['category'] {
  return detectTechnologies(name).at(0)?.category ?? 'soft_skill';
}

export async function mergeLinkedInImportIntoProfile(params: {
  profile: Profile;
  existingExperiences: Experience[];
  existingEducations: Education[];
  existingSkills: Skill[];
  parsed: LinkedInResumeImportResult;
}): Promise<{
  profile: Profile;
  experiencesToAdd: Experience[];
  educationsToAdd: Education[];
  skillsToAdd: Skill[];
  summary: LinkedInImportMergeSummary;
}> {
  const timestamp = nowIso();
  const profile = { ...params.profile };

  const [fullName, fullNameFilled] = normalizeProfileValue(profile.fullName, String(params.parsed.profilePatch.fullName ?? ''));
  const [headline, headlineFilled] = normalizeProfileValue(profile.headline, String(params.parsed.profilePatch.headline ?? ''));
  const [baseSummary, summaryFilled] = normalizeProfileValue(profile.baseSummary, String(params.parsed.profilePatch.baseSummary ?? ''));
  const [baseObjective, objectiveFilled] = normalizeProfileValue(profile.baseObjective, String(params.parsed.profilePatch.baseObjective ?? ''));
  const [email] = normalizeProfileValue(profile.email, String(params.parsed.profilePatch.email ?? ''));
  const [phone] = normalizeProfileValue(profile.phone, String(params.parsed.profilePatch.phone ?? ''));
  const [city] = normalizeProfileValue(profile.city, String(params.parsed.profilePatch.city ?? ''));
  const [state] = normalizeProfileValue(profile.state, String(params.parsed.profilePatch.state ?? ''));
  const [country] = normalizeProfileValue(profile.country, String(params.parsed.profilePatch.country ?? ''));
  const [linkedinUrl] = normalizeProfileValue(profile.linkedinUrl, String(params.parsed.profilePatch.linkedinUrl ?? ''));
  const [githubUrl] = normalizeProfileValue(profile.githubUrl, String(params.parsed.profilePatch.githubUrl ?? ''));

  Object.assign(profile, {
    fullName,
    headline,
    baseSummary,
    baseObjective,
    email,
    phone,
    city,
    state,
    country,
    linkedinUrl,
    githubUrl,
    updatedAt: timestamp,
    version: profile.version + 1
  });

  const experiencesToAdd: Experience[] = params.parsed.experiences.map((item, index) => ({
    id: makeId('exp'),
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
    profileId: profile.id,
    company: item.company,
    role: item.role,
    startDate: item.startDate,
    endDate: item.endDate,
    isCurrent: item.isCurrent,
    summary: item.summary,
    activities: item.activities,
    technologies: item.technologies,
    highlights: item.highlights,
    experienceType: 'real',
    sortOrder: index + 1
  }));

  const educationsToAdd: Education[] = params.parsed.educations.map((item) => ({
    id: makeId('edu'),
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
    profileId: profile.id,
    institution: item.institution,
    course: item.course,
    degreeType: item.degreeType,
    status: item.status,
    completionDate: item.completionDate
  }));

  const skillSignatures = new Set<string>();
  const skillsToAdd: Skill[] = params.parsed.skills
    .filter((item) => {
      const signature = normalizeHeading(item.name);

      if (signature === '' || skillSignatures.has(signature)) {
        return false;
      }

      skillSignatures.add(signature);
      return true;
    })
    .map((item) => ({
      id: makeId('skill'),
      createdAt: timestamp,
      updatedAt: timestamp,
      version: 1,
      profileId: profile.id,
      name: item.name,
      category: item.category || inferSkillCategory(item.name),
      level: item.level,
      evidenceType: item.evidenceType
    }));

  return {
    profile,
    experiencesToAdd,
    educationsToAdd,
    skillsToAdd,
    summary: {
      importedAt: timestamp,
      fullNameFilled,
      headlineFilled,
      summaryFilled,
      objectiveFilled,
      experiencesAdded: experiencesToAdd.length,
      educationsAdded: educationsToAdd.length,
      skillsAdded: skillsToAdd.length
    }
  };
}
