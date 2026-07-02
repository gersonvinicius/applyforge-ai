function normalizeTokens(value: string): string[] {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function toTitleToken(value: string): string {
  return value.slice(0, 1).toUpperCase() + value.slice(1).toLowerCase();
}

function profileNamePart(fullName: string): string {
  return normalizeTokens(fullName).map(toTitleToken).join('_');
}

function normalizeTitle(value: string): string {
  return value
    .replace(/\bfull[\s-]*stack\b/gi, 'Fullstack')
    .replace(/\bback[\s-]*end\b/gi, 'Backend')
    .replace(/\bfront[\s-]*end\b/gi, 'Frontend')
    .replace(/\bnode\.?js\b/gi, 'NodeJS')
    .replace(/\bnest\.?js\b/gi, 'NestJS')
    .replace(/\bnext\.?js\b/gi, 'NextJS')
    .replace(/\bvue\.?js\b/gi, 'VueJS')
    .replace(/\breact\.?js\b/gi, 'React')
    .replace(/\bc#\b/gi, 'CSharp')
    .replace(/\b\.net\b/gi, 'DotNet');
}

const rolePatterns: Array<{ label: string; pattern: RegExp }> = [
  { label: 'Fullstack', pattern: /\bFullstack\b/i },
  { label: 'Analista', pattern: /\bAnalista\b/i },
  { label: 'Backend', pattern: /\bBackend\b/i },
  { label: 'Frontend', pattern: /\bFrontend\b/i },
  { label: 'Arquiteto', pattern: /\bArquiteto\b|\bArchitect\b/i },
  { label: 'Engenheiro', pattern: /\bEngenheir[oa]\b|\bEngineer\b/i },
  { label: 'DevOps', pattern: /\bDevOps\b/i },
  { label: 'Mobile', pattern: /\bMobile\b/i },
  { label: 'QA', pattern: /\bQA\b/i }
];

const technologyPatterns: Array<{ label: string; pattern: RegExp }> = [
  { label: 'PHP', pattern: /\bPHP\b/i },
  { label: 'NodeJS', pattern: /\bNodeJS\b/i },
  { label: 'NestJS', pattern: /\bNestJS\b/i },
  { label: 'React', pattern: /\bReact\b/i },
  { label: 'Laravel', pattern: /\bLaravel\b/i },
  { label: 'CSharp', pattern: /\bCSharp\b/i },
  { label: 'DotNet', pattern: /\bDotNet\b/i },
  { label: 'Vue', pattern: /\bVueJS\b|\bVue\b/i },
  { label: 'Angular', pattern: /\bAngular\b/i },
  { label: 'TypeScript', pattern: /\bTypeScript\b/i },
  { label: 'JavaScript', pattern: /\bJavaScript\b/i },
  { label: 'Python', pattern: /\bPython\b/i },
  { label: 'Java', pattern: /\bJava\b/i },
  { label: 'Go', pattern: /\bGo\b/i },
  { label: 'Ruby', pattern: /\bRuby\b/i },
  { label: 'Magento', pattern: /\bMagento\b/i }
];

const stopWords = new Set([
  'de', 'da', 'do', 'das', 'dos', 'and', 'para', 'com', 'sr', 'sra', 'pleno', 'senior', 'junior',
  'developer', 'desenvolvedor', 'desenvolvedora', 'engineer', 'engenheiro', 'engenheira'
]);

function jobTitlePart(title: string): string {
  const normalizedTitle = normalizeTitle(title);
  const role = rolePatterns.find((item) => item.pattern.test(normalizedTitle))?.label ?? null;
  const technologies = technologyPatterns
    .filter((item) => item.pattern.test(normalizedTitle))
    .map((item) => item.label);

  const preferred = [...new Set([...(role ? [role] : []), ...(role ? technologies.slice(0, 1) : technologies.slice(0, 2))])];

  if (preferred.length > 0) {
    return preferred.join('_');
  }

  return normalizeTokens(normalizedTitle)
    .filter((token) => !stopWords.has(token.toLowerCase()))
    .map(toTitleToken)
    .slice(0, 2)
    .join('_');
}

export function makeResumeFileName(fullName: string, jobTitle: string): string {
  const namePart = profileNamePart(fullName);
  const jobPart = jobTitlePart(jobTitle);
  const base = [namePart, 'CV', jobPart].filter(Boolean).join('_') || 'Resume_CV';
  return `${base}.pdf`;
}
