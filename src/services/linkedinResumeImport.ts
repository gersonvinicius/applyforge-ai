import type { BinaryAsset, Education, Experience, Profile, Skill } from '@/domain/entities/types';
import { makeId } from '@/utils/ids';
import { extractPdfText } from '@/services/pdfText';

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
  { name: 'CI/CD', category: 'devops', patterns: [/\bci\/cd\b|\bcontinuous integration\b|\bcontinuous delivery\b/i] },
  { name: 'AWS', category: 'cloud', patterns: [/\baws\b|\bamazon web services\b/i] },
  { name: 'Azure', category: 'cloud', patterns: [/\bazure\b/i] },
  { name: 'GCP', category: 'cloud', patterns: [/\bgcp\b|\bgoogle cloud\b/i] },
  { name: 'C#', category: 'backend', patterns: [/\bc#\b/i] },
  { name: '.NET', category: 'backend', patterns: [/\b\.net\b|\bdotnet\b/i] },
  { name: 'Python', category: 'backend', patterns: [/\bpython\b/i] },
  { name: 'Java', category: 'backend', patterns: [/\bjava\b/i] },
  { name: 'Go', category: 'backend', patterns: [/\bgo\b|\bgolang\b/i] },
  { name: 'REST API', category: 'architecture', patterns: [/\brest\b|\bapi(?:s)?\b/i] },
  { name: 'GraphQL', category: 'architecture', patterns: [/\bgraphql\b/i] },
  { name: 'Linux', category: 'devops', patterns: [/\blinux\b/i] },
  { name: 'Scrum', category: 'soft_skill', patterns: [/\bscrum\b/i] },
  { name: 'Kanban', category: 'soft_skill', patterns: [/\bkanban\b/i] },
  { name: 'Jira', category: 'soft_skill', patterns: [/\bjira\b/i] },
  { name: 'RabbitMQ', category: 'architecture', patterns: [/\brabbitmq\b/i] },
  { name: 'OpenAI', category: 'ai', patterns: [/\bopenai\b|\bchatgpt\b/i] },
  { name: 'AI', category: 'ai', patterns: [/\bartificial intelligence\b|\binteligencia artificial\b|\bai\b/i] }
];

const sectionHeadings: Record<string, string[]> = {
  summary: ['about', 'sobre', 'summary', 'resumo'],
  experiences: ['experience', 'experiencias', 'experiências', 'experiencia', 'experiência'],
  education: ['education', 'educacao', 'educação', 'formacao', 'formação'],
  skills: ['skills', 'top skills', 'competencias', 'competências', 'habilidades']
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
    .filter((line) => !/^page \d+ of \d+$/i.test(line))
    .filter((line) => !/^save to pdf from linkedin$/i.test(line));
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

function detectName(headerLines: string[]): string {
  return headerLines.find((line) => {
    const words = line.split(' ').filter(Boolean);
    return words.length >= 2 && words.length <= 6 && !/[0-9@]/.test(line);
  }) ?? '';
}

function detectHeadline(headerLines: string[], fullName: string): string {
  return headerLines.find((line) => line !== fullName && !/[0-9@]/.test(line) && line.length > 6) ?? '';
}

function detectEmail(rawText: string): string {
  return rawText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? '';
}

function detectPhone(rawText: string): string {
  return rawText.match(/(?:\+\d{1,3}\s*)?(?:\(?\d{2,3}\)?\s*)?(?:\d[\s.-]*){8,14}\d/)?.[0]?.trim() ?? '';
}

function detectUrl(rawText: string, kind: 'linkedin' | 'github'): string {
  const pattern = kind === 'linkedin'
    ? /https?:\/\/(?:[\w.-]+\.)?linkedin\.com\/[^\s)]+/i
    : /https?:\/\/(?:[\w.-]+\.)?github\.com\/[^\s)]+/i;

  return rawText.match(pattern)?.[0] ?? '';
}

function detectLocation(headerLines: string[]): { city: string; state: string; country: string } {
  const locationLine = headerLines.find((line) =>
    !/[0-9@]/.test(line) &&
    !/^https?:\/\//i.test(line) &&
    (line.includes(',') || /\bbrasil\b|\bportugal\b/i.test(line))
  ) ?? '';

  if (locationLine === '') {
    return { city: '', state: '', country: '' };
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

  const yearMonthMatches = [...normalized.matchAll(/(?:\b([A-Za-zÀ-ÿ]{3,})\s+)?((?:19|20)\d{2})/g)];

  if (yearMonthMatches.length === 0) {
    return { startDate: '', endDate: '', isCurrent: /present|atual|momento/i.test(normalized) };
  }

  const first = yearMonthMatches[0];
  const last = yearMonthMatches.at(-1) ?? first;
  const isCurrent = /present|atual|momento/i.test(normalized);

  return {
    startDate: toIsoMonth(first[2], first[1]),
    endDate: isCurrent ? '' : toIsoMonth(last[2], last[1]),
    isCurrent
  };
}

function isDateRangeLine(line: string): boolean {
  return /(?:19|20)\d{2}/.test(line) && /-|present|atual|momento|to/i.test(line);
}

function extractHighlights(lines: string[]): string[] {
  const chunks = lines
    .flatMap((line) => line.split(/[.;•]/))
    .map((item) => normalizeWhitespace(item))
    .filter((item) => item.length >= 18);

  return [...new Set(chunks)].slice(0, 4);
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

function parseExperiences(lines: string[]): ImportedExperienceInput[] {
  const experiences: ImportedExperienceInput[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (!isDateRangeLine(line) || index < 2) {
      continue;
    }

    const role = normalizeWhitespace(lines[index - 2] ?? '');
    const company = normalizeWhitespace((lines[index - 1] ?? '').split('·')[0] ?? '');

    if (role === '' || company === '') {
      continue;
    }

    let cursor = index + 1;
    const details: string[] = [];

    while (cursor < lines.length && !isDateRangeLine(lines[cursor])) {
      details.push(lines[cursor]);
      cursor += 1;
    }

    const detailText = normalizeWhitespace(details.join(' '));
    const technologies = detectTechnologies([role, company, line, detailText].join(' ')).map((item) => item.name);
    const parsedRange = parseDateRange(line);

    experiences.push({
      company,
      role,
      startDate: parsedRange.startDate,
      endDate: parsedRange.endDate,
      isCurrent: parsedRange.isCurrent,
      summary: detailText,
      activities: details.slice(0, 3),
      technologies,
      highlights: extractHighlights(details)
    });

    index = cursor - 1;
  }

  const signatures = new Set<string>();

  return experiences.filter((item) => {
    const signature = normalizeHeading(`${item.company}|${item.role}|${item.startDate}`);

    if (signatures.has(signature)) {
      return false;
    }

    signatures.add(signature);
    return true;
  });
}

function parseEducation(lines: string[]): ImportedEducationInput[] {
  const entries: ImportedEducationInput[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (!isDateRangeLine(line) || index < 2) {
      continue;
    }

    const course = normalizeWhitespace(lines[index - 2] ?? '');
    const institution = normalizeWhitespace(lines[index - 1] ?? '');
    const parsedRange = parseDateRange(line);
    const status = parsedRange.isCurrent ? 'cursando' : 'concluido';
    const completionDate = parsedRange.isCurrent ? '' : parsedRange.endDate || parsedRange.startDate;

    if (course === '' || institution === '') {
      continue;
    }

    entries.push({
      institution,
      course,
      degreeType: '',
      status,
      completionDate
    });
  }

  if (entries.length > 0) {
    return entries;
  }

  const fallback: ImportedEducationInput[] = [];

  for (let index = 0; index < lines.length - 1; index += 2) {
    const course = normalizeWhitespace(lines[index] ?? '');
    const institution = normalizeWhitespace(lines[index + 1] ?? '');

    if (course === '' || institution === '') {
      continue;
    }

    fallback.push({
      institution,
      course,
      degreeType: '',
      status: '',
      completionDate: ''
    });
  }

  return fallback.slice(0, 3);
}

function parseSkills(lines: string[], rawText: string): ImportedSkillInput[] {
  const explicit = lines
    .flatMap((line) => line.split(/[,|•]/))
    .map((item) => normalizeWhitespace(item))
    .filter((item) => item.length >= 2 && item.length <= 40)
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
  });
}

export async function extractLinkedInResumeImport(asset: BinaryAsset): Promise<LinkedInResumeImportResult> {
  const rawText = await extractPdfText(asset.blob);
  const lines = normalizeLines(rawText);
  const sections = splitSections(lines);
  const fullName = detectName(sections.header);
  const headline = detectHeadline(sections.header, fullName);
  const location = detectLocation(sections.header);
  const summary = normalizeWhitespace(sections.summary.join(' '));

  return {
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
      baseSummary: summary
    },
    experiences: parseExperiences(sections.experiences),
    educations: parseEducation(sections.education),
    skills: parseSkills(sections.skills, rawText)
  };
}

export interface LinkedInImportMergeSummary {
  importedAt: string;
  fullNameFilled: boolean;
  headlineFilled: boolean;
  summaryFilled: boolean;
  experiencesAdded: number;
  educationsAdded: number;
  skillsAdded: number;
}

function fillIfBlank(current: string, incoming: string): [string, boolean] {
  if (normalizeWhitespace(current) !== '' || normalizeWhitespace(incoming) === '') {
    return [current, false];
  }

  return [incoming, true];
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
  let profileChanged = false;

  const [fullName, fullNameFilled] = fillIfBlank(profile.fullName, String(params.parsed.profilePatch.fullName ?? ''));
  const [headline, headlineFilled] = fillIfBlank(profile.headline, String(params.parsed.profilePatch.headline ?? ''));
  const [baseSummary, summaryFilled] = fillIfBlank(profile.baseSummary, String(params.parsed.profilePatch.baseSummary ?? ''));
  const [email] = fillIfBlank(profile.email, String(params.parsed.profilePatch.email ?? ''));
  const [phone] = fillIfBlank(profile.phone, String(params.parsed.profilePatch.phone ?? ''));
  const [city] = fillIfBlank(profile.city, String(params.parsed.profilePatch.city ?? ''));
  const [state] = fillIfBlank(profile.state, String(params.parsed.profilePatch.state ?? ''));
  const [country] = fillIfBlank(profile.country, String(params.parsed.profilePatch.country ?? ''));
  const [linkedinUrl] = fillIfBlank(profile.linkedinUrl, String(params.parsed.profilePatch.linkedinUrl ?? ''));
  const [githubUrl] = fillIfBlank(profile.githubUrl, String(params.parsed.profilePatch.githubUrl ?? ''));

  Object.assign(profile, {
    fullName,
    headline,
    baseSummary,
    email,
    phone,
    city,
    state,
    country,
    linkedinUrl,
    githubUrl
  });

  if (fullNameFilled || headlineFilled || summaryFilled || email !== params.profile.email || phone !== params.profile.phone || city !== params.profile.city || state !== params.profile.state || country !== params.profile.country || linkedinUrl !== params.profile.linkedinUrl || githubUrl !== params.profile.githubUrl) {
    profile.updatedAt = timestamp;
    profile.version += 1;
    profileChanged = true;
  }

  const experienceSignatures = new Set(
    params.existingExperiences.map((item) => normalizeHeading(`${item.company}|${item.role}|${item.startDate}`))
  );
  const educationSignatures = new Set(
    params.existingEducations.map((item) => normalizeHeading(`${item.institution}|${item.course}|${item.completionDate}`))
  );
  const skillSignatures = new Set(
    params.existingSkills.map((item) => normalizeHeading(item.name))
  );

  const experiencesToAdd: Experience[] = params.parsed.experiences
    .filter((item) => !experienceSignatures.has(normalizeHeading(`${item.company}|${item.role}|${item.startDate}`)))
    .map((item, index) => ({
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
      sortOrder: params.existingExperiences.length + index + 1
    }));

  const educationsToAdd: Education[] = params.parsed.educations
    .filter((item) => !educationSignatures.has(normalizeHeading(`${item.institution}|${item.course}|${item.completionDate}`)))
    .map((item) => ({
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

  const skillsToAdd: Skill[] = params.parsed.skills
    .filter((item) => !skillSignatures.has(normalizeHeading(item.name)))
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

  if (!profileChanged) {
    profile.updatedAt = params.profile.updatedAt;
    profile.version = params.profile.version;
  }

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
      experiencesAdded: experiencesToAdd.length,
      educationsAdded: educationsToAdd.length,
      skillsAdded: skillsToAdd.length
    }
  };
}
