import type { Profile } from '@/domain/entities/types';

export interface ResumePayload {
  title?: string;
  recommended_resume_title?: string;
  recommended_file_name?: string;
  positioning?: string;
  base_technical_stack?: string[];
  immediate_differentiator?: string;
  summary?: string;
  key_skills?: string[];
  experiences?: Array<{
    company?: string;
    role?: string;
    period?: string;
    summary?: string;
    highlights?: string[];
  }>;
  education?: Array<{
    institution?: string;
    course?: string;
    details?: string;
  }>;
  objective?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function joinInline(values: Array<string | null | undefined>): string {
  return values.map((item) => String(item ?? '').trim()).filter(Boolean).join(' | ');
}

function renderSkills(items: string[], asMatrix: boolean): string {
  const skills = items.map((item) => escapeHtml(item.trim())).filter(Boolean);

  if (skills.length === 0) {
    return '<p class="muted">Sem skills estruturadas.</p>';
  }

  if (asMatrix) {
    return `
      <div class="skills-grid">
        ${skills.map((item) => `<span class="skill-chip">${item}</span>`).join('')}
      </div>
    `;
  }

  return `
    <div class="pill-list">
      ${skills.map((item) => `<span class="pill">${item}</span>`).join('')}
    </div>
  `;
}

function renderExperiences(payload: ResumePayload): string {
  const experiences = payload.experiences ?? [];

  if (experiences.length === 0) {
    return '<p class="muted">Sem experiencias estruturadas.</p>';
  }

  return experiences.map((experience) => {
    const highlights = (experience.highlights ?? [])
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 4);

    return `
      <article class="resume-entry">
        <div class="resume-entry-title">${escapeHtml(joinInline([experience.role, experience.company]))}</div>
        ${experience.period ? `<div class="resume-entry-meta">${escapeHtml(experience.period)}</div>` : ''}
        ${experience.summary ? `<p class="resume-copy">${escapeHtml(experience.summary)}</p>` : ''}
        ${highlights.length > 0 ? `
          <ul class="resume-list">
            ${highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
          </ul>
        ` : ''}
      </article>
    `;
  }).join('');
}

function renderEducation(payload: ResumePayload): string {
  const items = payload.education ?? [];

  if (items.length === 0) {
    return '<p class="muted">Sem formacao estruturada.</p>';
  }

  return items.map((item) => `
    <article class="resume-entry">
      <div class="resume-entry-title">${escapeHtml(joinInline([item.course, item.institution]))}</div>
      ${item.details ? `<div class="resume-entry-meta">${escapeHtml(item.details)}</div>` : ''}
    </article>
  `).join('');
}

function renderClassic(profile: Profile, payload: ResumePayload): string {
  return `
    <div class="resume-page classic">
      <header class="resume-header">
        <h1>${escapeHtml(profile.fullName || 'Curriculo')}</h1>
        <p class="resume-headline">${escapeHtml(payload.title || payload.recommended_resume_title || profile.headline || '')}</p>
        <p class="resume-meta">${escapeHtml(joinInline([
          joinInline([profile.city, profile.state]),
          profile.country,
          profile.email,
          profile.phone
        ]))}</p>
        <p class="resume-meta">${escapeHtml(joinInline([profile.linkedinUrl, profile.githubUrl]))}</p>
      </header>

      <section class="resume-section">
        <h2>Posicionamento</h2>
        <p class="resume-copy">${escapeHtml(payload.positioning || profile.baseObjective || '')}</p>
      </section>

      <section class="resume-section">
        <h2>Resumo Profissional</h2>
        <p class="resume-copy">${escapeHtml(payload.summary || profile.baseSummary || '')}</p>
      </section>

      <section class="resume-section">
        <h2>Base Tecnica</h2>
        ${renderSkills(payload.base_technical_stack ?? payload.key_skills ?? [], false)}
      </section>

      <section class="resume-section">
        <h2>Diferencial Imediato</h2>
        <p class="resume-copy">${escapeHtml(payload.immediate_differentiator || '')}</p>
      </section>

      <section class="resume-section">
        <h2>Experiencia Profissional</h2>
        ${renderExperiences(payload)}
      </section>

      <section class="resume-section">
        <h2>Formacao</h2>
        ${renderEducation(payload)}
      </section>

      <section class="resume-section">
        <h2>Objetivo</h2>
        <p class="resume-copy">${escapeHtml(payload.objective || profile.baseObjective || '')}</p>
      </section>
    </div>
  `;
}

function renderCompact(profile: Profile, payload: ResumePayload): string {
  return `
    <div class="resume-page compact">
      <header class="resume-header compact-header">
        <div>
          <h1>${escapeHtml(profile.fullName || 'Curriculo')}</h1>
          <p class="resume-headline">${escapeHtml(payload.title || payload.recommended_resume_title || profile.headline || '')}</p>
        </div>
        <div class="compact-meta">
          <p>${escapeHtml(joinInline([profile.email, profile.phone]))}</p>
          <p>${escapeHtml(joinInline([joinInline([profile.city, profile.state]), profile.country]))}</p>
        </div>
      </header>

      <section class="resume-section">
        <h2>Resumo</h2>
        <p class="resume-copy">${escapeHtml(payload.summary || profile.baseSummary || '')}</p>
      </section>

      <section class="resume-section">
        <h2>Skills-Chave</h2>
        ${renderSkills(payload.key_skills ?? payload.base_technical_stack ?? [], true)}
      </section>

      <section class="resume-section">
        <h2>Experiencias</h2>
        ${renderExperiences(payload)}
      </section>

      <section class="resume-section">
        <h2>Formacao</h2>
        ${renderEducation(payload)}
      </section>
    </div>
  `;
}

function renderReference(profile: Profile, payload: ResumePayload): string {
  return `
    <div class="resume-page reference">
      <div class="top-rule"></div>
      <header class="resume-header reference-header">
        <h1>${escapeHtml((profile.fullName || 'Curriculo').toUpperCase())}</h1>
        <p class="resume-headline">${escapeHtml(payload.title || payload.recommended_resume_title || profile.headline || '')}</p>
        <p class="resume-meta">${escapeHtml(joinInline([
          joinInline([profile.city, profile.state]),
          profile.country,
          profile.phone,
          profile.email,
          profile.linkedinUrl,
          profile.githubUrl
        ]))}</p>
      </header>

      <div class="feature-grid">
        <section class="feature-card">
          <h3>Posicionamento</h3>
          <p>${escapeHtml(payload.positioning || profile.baseObjective || '')}</p>
        </section>
        <section class="feature-card">
          <h3>Base Tecnica</h3>
          <p>${escapeHtml((payload.base_technical_stack ?? []).join(', '))}</p>
        </section>
        <section class="feature-card">
          <h3>Diferencial</h3>
          <p>${escapeHtml(payload.immediate_differentiator || '')}</p>
        </section>
      </div>

      <section class="resume-section">
        <h2>Resumo Profissional</h2>
        <p class="resume-copy">${escapeHtml(payload.summary || profile.baseSummary || '')}</p>
      </section>

      <section class="resume-section">
        <h2>Competencias-Chave</h2>
        ${renderSkills(payload.key_skills ?? payload.base_technical_stack ?? [], true)}
      </section>

      <section class="resume-section">
        <h2>Experiencia Profissional</h2>
        ${renderExperiences(payload)}
      </section>

      <section class="resume-section">
        <h2>Formacao Academica</h2>
        ${renderEducation(payload)}
      </section>

      <section class="resume-section">
        <h2>Objetivo</h2>
        <p class="resume-copy">${escapeHtml(payload.objective || profile.baseObjective || '')}</p>
      </section>
    </div>
  `;
}

export function renderResumeHtml(profile: Profile, payload: ResumePayload): string {
  const body = profile.resumeTemplate === 'compact'
    ? renderCompact(profile, payload)
    : profile.resumeTemplate === 'reference_pdf'
      ? renderReference(profile, payload)
      : renderClassic(profile, payload);

  return `<!DOCTYPE html>
  <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(payload.title || profile.fullName || 'Resume')}</title>
      <style>
        :root {
          color-scheme: light;
          --text: #1f2937;
          --muted: #6b7280;
          --accent: #92400e;
          --line: #d6d3d1;
          --soft: #f5f5f4;
          --blue: #173a5e;
          font-family: "Segoe UI", Arial, sans-serif;
        }
        * { box-sizing: border-box; }
        body { margin: 0; background: #f2efe9; color: var(--text); }
        .resume-page {
          width: 210mm;
          min-height: 297mm;
          margin: 24px auto;
          background: #fff;
          padding: 26mm 20mm;
          box-shadow: 0 12px 40px rgba(15, 23, 42, 0.12);
        }
        .resume-page.reference { padding-top: 18mm; }
        .resume-header h1 {
          margin: 0;
          font-size: 28px;
          line-height: 1.05;
        }
        .resume-headline, .resume-meta, .resume-copy, .resume-entry-meta {
          margin: 0;
        }
        .resume-headline { margin-top: 6px; color: #374151; font-size: 15px; }
        .resume-meta { margin-top: 4px; color: var(--muted); font-size: 12px; }
        .resume-section { margin-top: 18px; }
        .resume-section h2 {
          margin: 0 0 8px;
          color: var(--accent);
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          border-bottom: 1px solid var(--line);
          padding-bottom: 4px;
        }
        .resume-copy { font-size: 13px; line-height: 1.45; }
        .pill-list, .skills-grid { display: flex; flex-wrap: wrap; gap: 8px; }
        .pill, .skill-chip {
          display: inline-flex;
          align-items: center;
          padding: 4px 9px;
          border-radius: 999px;
          background: var(--soft);
          font-size: 11px;
        }
        .skills-grid { gap: 6px; }
        .skill-chip {
          border: 1px solid #dbe2ea;
          border-radius: 8px;
          background: #eef3f8;
          color: #173a5e;
        }
        .resume-entry { margin-top: 12px; }
        .resume-entry-title { font-size: 14px; font-weight: 700; }
        .resume-entry-meta { margin-top: 2px; color: var(--muted); font-size: 11px; }
        .resume-list { margin: 8px 0 0 18px; padding: 0; font-size: 12px; line-height: 1.4; }
        .muted { color: var(--muted); }
        .compact-header {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          align-items: flex-start;
        }
        .compact-meta { text-align: right; color: var(--muted); font-size: 12px; }
        .top-rule { height: 4px; background: var(--blue); margin-bottom: 10px; }
        .reference-header h1 { color: var(--blue); font-size: 30px; letter-spacing: 0.04em; }
        .feature-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          margin-top: 14px;
        }
        .feature-card {
          border: 1px solid #c8d6e4;
          background: #eef3f8;
          padding: 10px;
        }
        .feature-card h3 {
          margin: 0 0 6px;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: var(--blue);
        }
        .feature-card p {
          margin: 0;
          font-size: 11px;
          line-height: 1.35;
        }
        @media print {
          body { background: #fff; }
          .resume-page { margin: 0; box-shadow: none; }
        }
        @media (max-width: 900px) {
          .resume-page {
            width: 100%;
            min-height: auto;
            margin: 0;
            padding: 24px;
          }
          .compact-header, .feature-grid { grid-template-columns: 1fr; display: grid; }
          .compact-meta { text-align: left; }
        }
      </style>
    </head>
    <body>${body}</body>
  </html>`;
}
