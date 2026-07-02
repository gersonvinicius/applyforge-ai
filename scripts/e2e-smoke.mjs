import http from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';

const APP_PORT = 4173;
const MOCK_PORT = 8787;
const CHROME_PORT = 9222;
const APP_URL = `http://127.0.0.1:${APP_PORT}`;
const MOCK_BASE = `http://127.0.0.1:${MOCK_PORT}`;

function log(step, message) {
  process.stdout.write(`[${step}] ${message}\n`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(check, description, timeoutMs = 20000, intervalMs = 250) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const value = await check();

    if (value) {
      return value;
    }

    await sleep(intervalMs);
  }

  throw new Error(`Timeout aguardando: ${description}`);
}

function createMockServer() {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url || '/', `http://127.0.0.1:${MOCK_PORT}`);

    if (request.method === 'OPTIONS') {
      response.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, HTTP-Referer, X-Title',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      });
      response.end();
      return;
    }

    if (url.pathname === '/openrouter/chat/completions' && request.method === 'POST') {
      const chunks = [];

      for await (const chunk of request) {
        chunks.push(chunk);
      }

      const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const prompt = String(payload?.messages?.[0]?.content ?? '');
      let content = 'OK';

      if (prompt.includes('Analyze the job below')) {
        content = JSON.stringify({
          job_title: 'Mock Senior PHP Platform Engineer',
          company: 'Mock Labs',
          seniority: 'senior',
          work_model: 'remote',
          required_skills: ['PHP', 'Laravel', 'REST APIs'],
          desired_skills: ['Docker', 'CI/CD'],
          responsibilities: ['Desenvolver APIs', 'Manter arquitetura', 'Colaborar com produto'],
          keywords: ['php', 'laravel', 'remote'],
          risks: ['Experiencia com CI/CD ainda pode ser expandida'],
          fit_score: 84,
          fit_level: 'strong',
          fit_summary: 'Boa aderencia para stack PHP/Laravel com foco remoto.',
          missing_requirements: ['Maior profundidade em CI/CD'],
          suggested_positioning: 'Destacar experiencia backend com APIs REST e entregas remotas.',
          recommended_resume_title: 'Fullstack PHP',
          recommended_file_name: 'Gerson_Teste_CV_Fullstack_PHP.pdf'
        });
      } else if (prompt.includes('Generate a tailored resume payload')) {
        content = JSON.stringify({
          title: 'Fullstack PHP',
          recommended_resume_title: 'Fullstack PHP',
          recommended_file_name: 'Gerson_Teste_CV_Fullstack_PHP.pdf',
          positioning: 'Desenvolvedor Full Stack com foco em PHP, APIs e entrega remota.',
          base_technical_stack: ['PHP', 'Laravel', 'MySQL', 'REST APIs'],
          immediate_differentiator: 'Experiencia pratica em sustentacao e evolucao de produtos web.',
          summary: 'Profissional com experiencia em backend PHP e evolucao de funcionalidades orientadas a negocio.',
          key_skills: ['PHP', 'Laravel', 'APIs REST', 'MySQL', 'Git', 'Docker'],
          experiences: [
            {
              company: 'Empresa Mock',
              role: 'Desenvolvedor Full Stack',
              period: '2022-01 - Atual',
              summary: 'Atuacao em evolucao de APIs, manutencao de sistemas web e suporte tecnico ao produto.',
              highlights: ['Implementacao de APIs REST', 'Manutencao de regras de negocio', 'Colaboracao com time remoto']
            }
          ],
          education: [
            {
              institution: 'Faculdade Exemplo',
              course: 'Sistemas de Informacao',
              details: 'Concluido'
            }
          ],
          objective: 'Contribuir em produtos PHP/Laravel com foco em qualidade e evolucao continua.'
        });
      } else if (prompt.includes('Generate short application-form answers')) {
        content = JSON.stringify({
          answers: [
            {
              question: 'Conte sua experiencia com a stack da vaga',
              short_answer: 'Atuo com PHP, Laravel e APIs REST em rotinas de desenvolvimento e manutencao.',
              medium_answer: 'Tenho experiencia com PHP e Laravel no desenvolvimento e evolucao de funcionalidades, integracoes e APIs REST.',
              long_answer: 'Minha experiencia inclui desenvolvimento e manutencao de funcionalidades com PHP e Laravel, estruturacao de APIs REST, suporte a regras de negocio e colaboracao com times remotos.'
            },
            {
              question: 'Experiencia com Scrum/Kanban',
              short_answer: 'Ja atuei em rotinas organizadas com acompanhamento de tarefas e entregas incrementais.',
              medium_answer: 'Tenho familiaridade com organizacao de backlog, priorizacao e acompanhamento de entregas em fluxo colaborativo.',
              long_answer: 'Atuo bem em rotinas com backlog, priorizacao, acompanhamento de tarefas e entregas incrementais, mantendo comunicacao clara com o time.'
            },
            {
              question: 'Resumo da experiencia mais recente',
              short_answer: 'Experiencia recente com evolucao de sistemas web e APIs.',
              medium_answer: 'Minha experiencia recente envolve manutencao e evolucao de sistemas web, APIs REST e suporte a demandas de negocio.',
              long_answer: 'Na experiencia mais recente, atuei na manutencao e evolucao de sistemas web, implementacao de APIs REST e ajustes de funcionalidades alinhadas ao produto.'
            }
          ]
        });
      }

      response.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      });
      response.end(JSON.stringify({
        model: payload.model,
        choices: [{ message: { content } }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }
      }));
      return;
    }

    if (url.pathname === '/v1/api/jobs/br/search/1' && request.method === 'GET') {
      const callback = url.searchParams.get('callback') || 'callback';
      const payload = {
        count: 1,
        results: [
          {
            title: 'Mock Senior PHP Platform Engineer',
            description: 'Remote role working with PHP, Laravel, REST APIs and product evolution.',
            redirect_url: 'https://mock.example/jobs/php-platform-engineer',
            created: '2026-07-01T10:00:00Z',
            company: { display_name: 'Mock Labs' },
            location: { display_name: 'Brasil' }
          }
        ]
      };

      response.writeHead(200, {
        'Content-Type': 'text/javascript; charset=utf-8'
      });
      response.end(`${callback}(${JSON.stringify(payload)});`);
      return;
    }

    response.writeHead(404, { 'Content-Type': 'text/plain' });
    response.end('not found');
  });
}

function spawnProcess(command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options
  });

  child.stdout?.on('data', (chunk) => process.stdout.write(`[${command}] ${chunk}`));
  child.stderr?.on('data', (chunk) => process.stderr.write(`[${command}] ${chunk}`));

  return child;
}

async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} em ${url}`);
  }

  return response.json();
}

async function connectToPageDebugger() {
  const targets = await waitFor(async () => {
    try {
      const value = await fetchJson(`http://127.0.0.1:${CHROME_PORT}/json/list`);

      return Array.isArray(value) && value.length > 0 ? value : null;
    } catch {
      return null;
    }
  }, 'target do Chromium');

  const target = targets.find((item) => String(item.url || '').startsWith(APP_URL));

  if (!target?.webSocketDebuggerUrl) {
    throw new Error('Pagina do app nao encontrada no debugger do Chromium.');
  }

  const socket = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  let nextId = 1;

  socket.onmessage = (event) => {
    const payload = JSON.parse(String(event.data));

    if (!payload.id) {
      return;
    }

    const resolver = pending.get(payload.id);

    if (!resolver) {
      return;
    }

    pending.delete(payload.id);

    if (payload.error) {
      resolver.reject(new Error(payload.error.message || 'Erro CDP desconhecido.'));
      return;
    }

    resolver.resolve(payload.result);
  };

  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });

  async function cdp(method, params = {}) {
    const id = nextId++;

    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }

  await cdp('Page.enable');
  await cdp('Runtime.enable');

  return {
    socket,
    cdp,
    async evaluate(expression) {
      const result = await cdp('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true
      });

      return result?.result?.value;
    }
  };
}

function js(value) {
  return JSON.stringify(value);
}

async function main() {
  const mockServer = createMockServer();
  const chromeProfile = await mkdtemp(path.join(os.tmpdir(), 'applyforge-e2e-'));
  let vite;
  let chromium;
  let debuggerClient;

  try {
    await new Promise((resolve, reject) => {
      mockServer.listen(MOCK_PORT, '127.0.0.1', (error) => error ? reject(error) : resolve());
    });
    log('mock', `servidor mock em ${MOCK_BASE}`);

    vite = spawnProcess('/bin/bash', ['-lc', `npm run dev -- --host 127.0.0.1 --port ${APP_PORT}`], {
      cwd: path.resolve('.')
    });

    await waitFor(async () => {
      try {
        const response = await fetch(APP_URL);
        return response.ok;
      } catch {
        return false;
      }
    }, 'Vite subir');
    log('app', `Vite pronto em ${APP_URL}`);

    chromium = spawnProcess('/usr/bin/chromium', [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      `--remote-debugging-port=${CHROME_PORT}`,
      `--user-data-dir=${chromeProfile}`,
      APP_URL
    ]);

    debuggerClient = await connectToPageDebugger();
    const { evaluate } = debuggerClient;

    await waitFor(async () => {
      try {
        return await evaluate('document.readyState === "complete" && !!document.querySelector(".nav-list")');
      } catch {
        return false;
      }
    }, 'app carregar');

    await evaluate(`
      (() => {
        window.__codexE2E = {
          navigate(href) {
            const link = document.querySelector('a[href="' + href + '"]');
            if (!link) throw new Error('Link nao encontrado: ' + href);
            link.click();
          },
          card(title) {
            return [...document.querySelectorAll('.card')].find((item) =>
              item.querySelector('.card-title')?.textContent?.trim() === title
            );
          },
          entry(title) {
            return [...document.querySelectorAll('article.entry-card')].find((item) =>
              item.querySelector('.card-title, strong')?.textContent?.trim() === title
            );
          },
          field(cardTitle, fieldLabel) {
            const card = this.card(cardTitle);
            if (!card) throw new Error('Card nao encontrado: ' + cardTitle);
            const label = [...card.querySelectorAll('label.field-stack')].find((item) =>
              item.querySelector('.field-label')?.textContent?.trim() === fieldLabel
            );
            if (!label) throw new Error('Campo nao encontrado: ' + cardTitle + ' / ' + fieldLabel);
            const input = label.querySelector('input, textarea, select');
            if (!input) throw new Error('Elemento de input nao encontrado: ' + fieldLabel);
            return input;
          },
          setField(cardTitle, fieldLabel, value) {
            const input = this.field(cardTitle, fieldLabel);
            input.focus();
            if (input.tagName === 'SELECT') {
              input.value = value;
              input.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
              input.value = value;
              input.dispatchEvent(new Event('input', { bubbles: true }));
              input.dispatchEvent(new Event('change', { bubbles: true }));
            }
          },
          setCheckbox(cardTitle, fieldLabel, checked) {
            const input = this.field(cardTitle, fieldLabel);
            input.checked = checked;
            input.dispatchEvent(new Event('change', { bubbles: true }));
          },
          fieldInEntry(entryTitle, fieldLabel) {
            const entry = this.entry(entryTitle);
            if (!entry) throw new Error('Bloco nao encontrado: ' + entryTitle);
            const label = [...entry.querySelectorAll('label.field-stack')].find((item) =>
              item.querySelector('.field-label')?.textContent?.trim() === fieldLabel
            );
            if (!label) throw new Error('Campo nao encontrado: ' + entryTitle + ' / ' + fieldLabel);
            const input = label.querySelector('input, textarea, select');
            if (!input) throw new Error('Elemento de input nao encontrado: ' + fieldLabel);
            return input;
          },
          setFieldInEntry(entryTitle, fieldLabel, value) {
            const input = this.fieldInEntry(entryTitle, fieldLabel);
            input.focus();
            if (input.tagName === 'SELECT') {
              input.value = value;
              input.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
              input.value = value;
              input.dispatchEvent(new Event('input', { bubbles: true }));
              input.dispatchEvent(new Event('change', { bubbles: true }));
            }
          },
          setCheckboxInEntry(entryTitle, fieldLabel, checked) {
            const input = this.fieldInEntry(entryTitle, fieldLabel);
            input.checked = checked;
            input.dispatchEvent(new Event('change', { bubbles: true }));
          },
          clickButtonInCard(cardTitle, buttonText) {
            const card = this.card(cardTitle);
            if (!card) throw new Error('Card nao encontrado: ' + cardTitle);
            const button = [...card.querySelectorAll('button')].find((item) =>
              item.textContent?.trim().includes(buttonText)
            );
            if (!button) throw new Error('Botao nao encontrado: ' + cardTitle + ' / ' + buttonText);
            button.click();
          },
          clickButtonInEntry(entryTitle, buttonText) {
            const entry = this.entry(entryTitle);
            if (!entry) throw new Error('Bloco nao encontrado: ' + entryTitle);
            const button = [...entry.querySelectorAll('button')].find((item) =>
              item.textContent?.trim().includes(buttonText)
            );
            if (!button) throw new Error('Botao nao encontrado: ' + entryTitle + ' / ' + buttonText);
            button.click();
          },
          clickPageButton(buttonText) {
            const button = [...document.querySelectorAll('button')].find((item) =>
              item.textContent?.trim().includes(buttonText)
            );
            if (!button) throw new Error('Botao nao encontrado: ' + buttonText);
            button.click();
          },
          clickTableAction(rowText, buttonText) {
            const row = [...document.querySelectorAll('tbody tr')].find((item) =>
              item.innerText.includes(rowText)
            );
            if (!row) throw new Error('Linha nao encontrada: ' + rowText);
            const button = [...row.querySelectorAll('button')].find((item) =>
              item.textContent?.trim().includes(buttonText)
            );
            if (!button) throw new Error('Acao nao encontrada: ' + buttonText);
            button.click();
          },
          text() {
            return document.body.innerText;
          },
          setFieldByPlaceholder(placeholder, value) {
            const input = document.querySelector('[placeholder="' + placeholder + '"]');
            if (!input) throw new Error('Placeholder nao encontrado: ' + placeholder);
            input.focus();
            input.value = value;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          },
          clickJobAction(jobTitle, buttonText) {
            const card = [...document.querySelectorAll('article.entry-card')].find((item) => {
              const titleInput = [...item.querySelectorAll('input')].find((input) => input.placeholder === 'Backend PHP Developer');
              return titleInput?.value?.includes(jobTitle);
            });
            if (!card) throw new Error('Card da vaga nao encontrado: ' + jobTitle);
            const button = [...card.querySelectorAll('button')].find((item) =>
              item.textContent?.trim().includes(buttonText)
            );
            if (!button) throw new Error('Botao da vaga nao encontrado: ' + buttonText);
            button.click();
          }
        };
        return true;
      })()
    `);

    log('settings', 'configurando OpenRouter mock');
    await evaluate(`window.__codexE2E.navigate('/configuracoes')`);
    await waitFor(() => evaluate(`location.pathname === '/configuracoes'`), 'rota configuracoes');
    await evaluate(`window.__codexE2E.setField(${js('Provider de IA local')}, ${js('Base URL')}, ${js(`${MOCK_BASE}/openrouter`)})`);
    await evaluate(`window.__codexE2E.setField(${js('Provider de IA local')}, ${js('API key')}, ${js('mock-openrouter-key')})`);
    await evaluate(`window.__codexE2E.setCheckbox(${js('Provider de IA local')}, ${js('Ativo')}, true)`);
    await evaluate(`window.__codexE2E.clickButtonInCard(${js('Provider de IA local')}, ${js('Salvar provider')})`);
    await evaluate(`window.__codexE2E.clickButtonInCard(${js('Provider de IA local')}, ${js('Testar conexao')})`);
    await waitFor(() => evaluate(`window.__codexE2E.text().includes('Conexao OK com openrouter')`), 'teste OpenRouter');

    log('settings', 'configurando Adzuna mock');
    await evaluate(`window.__codexE2E.setFieldInEntry(${js('Adzuna API')}, ${js('Base URL')}, ${js(`${MOCK_BASE}/v1/api/jobs`)})`);
    await evaluate(`window.__codexE2E.setCheckboxInEntry(${js('Adzuna API')}, ${js('Ativo')}, true)`);
    await evaluate(`window.__codexE2E.setFieldInEntry(${js('Adzuna API')}, ${js('App ID')}, ${js('mock-adzuna-app')})`);
    await evaluate(`window.__codexE2E.setFieldInEntry(${js('Adzuna API')}, ${js('App Key')}, ${js('mock-adzuna-key')})`);
    await evaluate(`window.__codexE2E.clickButtonInEntry(${js('Adzuna API')}, ${js('Salvar provider')})`);
    await evaluate(`window.__codexE2E.clickButtonInEntry(${js('Adzuna API')}, ${js('Testar provider')})`);
    await waitFor(() => evaluate(`window.__codexE2E.text().includes('Conexao OK com adzuna')`), 'teste Adzuna');

    log('profile', 'preenchendo perfil base e experiencia');
    await evaluate(`window.__codexE2E.navigate('/perfil')`);
    await waitFor(() => evaluate(`location.pathname === '/perfil'`), 'rota perfil');
    await evaluate(`window.__codexE2E.setField(${js('Perfil base')}, ${js('Nome completo')}, ${js('Gerson Teste')})`);
    await evaluate(`window.__codexE2E.setField(${js('Perfil base')}, ${js('Headline')}, ${js('Desenvolvedor Full Stack PHP')})`);
    await evaluate(`window.__codexE2E.setField(${js('Perfil base')}, ${js('E-mail')}, ${js('gerson.teste@example.com')})`);
    await evaluate(`window.__codexE2E.setField(${js('Perfil base')}, ${js('Resumo base')}, ${js('Resumo profissional de teste para validacao end-to-end.')})`);
    await evaluate(`window.__codexE2E.setField(${js('Perfil base')}, ${js('Objetivo base')}, ${js('Atuar em vagas remotas com PHP e Laravel.')})`);
    await evaluate(`window.__codexE2E.clickPageButton(${js('Salvar perfil')})`);
    await evaluate(`window.__codexE2E.clickButtonInCard(${js('Experiencias')}, ${js('Adicionar experiencia')})`);
    await waitFor(() => evaluate(`document.querySelectorAll('input[placeholder="Empresa"]').length > 0`), 'formulario de experiencia');
    await evaluate(`window.__codexE2E.setFieldByPlaceholder(${js('Empresa')}, ${js('Empresa Mock')})`);
    await evaluate(`window.__codexE2E.setFieldByPlaceholder(${js('Cargo')}, ${js('Desenvolvedor Full Stack')})`);
    await evaluate(`window.__codexE2E.setFieldByPlaceholder(${js('2022-01')}, ${js('2022-01')})`);
    await evaluate(`window.__codexE2E.setFieldByPlaceholder(${js('Resumo geral da experiencia.')}, ${js('Atuacao com PHP, APIs REST e manutencao de sistemas web.')})`);
    await evaluate(`window.__codexE2E.clickPageButton(${js('Salvar experiencia')})`);
    await evaluate(`window.__codexE2E.clickButtonInCard(${js('Competencias')}, ${js('Adicionar competencia')})`);
    await waitFor(() => evaluate(`document.querySelectorAll('input[placeholder="Laravel"]').length > 0`), 'formulario de competencia');
    await evaluate(`window.__codexE2E.setFieldByPlaceholder(${js('Laravel')}, ${js('Laravel')})`);
    await evaluate(`window.__codexE2E.clickPageButton(${js('Salvar competencia')})`);

    log('searches', 'criando e executando esquema Adzuna');
    await evaluate(`window.__codexE2E.navigate('/buscas')`);
    await waitFor(() => evaluate(`location.pathname === '/buscas'`), 'rota buscas');
    await evaluate(`window.__codexE2E.setField(${js('Formulario do esquema')}, ${js('Nome')}, ${js('Mock Adzuna PHP')})`);
    await evaluate(`window.__codexE2E.setField(${js('Formulario do esquema')}, ${js('Provider')}, ${js('adzuna')})`);
    await evaluate(`window.__codexE2E.setField(${js('Formulario do esquema')}, ${js('Localidade')}, ${js('Brasil')})`);
    await evaluate(`window.__codexE2E.setField(${js('Formulario do esquema')}, ${js('Senioridade')}, ${js('senior')})`);
    await evaluate(`window.__codexE2E.setField(${js('Formulario do esquema')}, ${js('Keywords')}, ${js('php')})`);
    await evaluate(`window.__codexE2E.setField(${js('Formulario do esquema')}, ${js('Pais')}, ${js('br')})`);
    await evaluate(`window.__codexE2E.clickPageButton(${js('Criar esquema')})`);
    await waitFor(() => evaluate(`window.__codexE2E.text().includes('Mock Adzuna PHP')`), 'schema salvo');
    await evaluate(`window.__codexE2E.clickTableAction(${js('Mock Adzuna PHP')}, ${js('Executar')})`);
    await waitFor(() => evaluate(`window.__codexE2E.text().includes('Busca executada com sucesso.')`), 'execucao de busca');

    log('jobs', 'validando pipeline de vaga');
    await evaluate(`window.__codexE2E.navigate('/vagas')`);
    await waitFor(() => evaluate(`location.pathname === '/vagas'`), 'rota vagas');
    await waitFor(() => evaluate(`window.__codexE2E.text().includes('Mock Senior PHP Platform Engineer')`), 'vaga importada');
    await evaluate(`window.__codexE2E.clickJobAction(${js('Mock Senior PHP Platform Engineer')}, ${js('Analisar vaga')})`);
    await waitFor(() => evaluate(`window.__codexE2E.text().includes('Boa aderencia para stack PHP/Laravel com foco remoto.')`), 'analise concluida');
    await evaluate(`window.__codexE2E.clickJobAction(${js('Mock Senior PHP Platform Engineer')}, ${js('Gerar respostas')})`);
    await waitFor(() => evaluate(`window.__codexE2E.text().includes('Ver respostas geradas')`), 'respostas geradas');
    await evaluate(`window.__codexE2E.clickJobAction(${js('Mock Senior PHP Platform Engineer')}, ${js('Gerar CV')})`);
    await waitFor(() => evaluate(`window.__codexE2E.text().includes('cv local gerado')`), 'cv gerado');

    log('logs', 'checando rastros locais');
    await evaluate(`window.__codexE2E.navigate('/logs')`);
    await waitFor(() => evaluate(`location.pathname === '/logs'`), 'rota logs');
    await waitFor(() => evaluate(`window.__codexE2E.text().includes('Analise concluida') && window.__codexE2E.text().includes('CV adaptado gerado')`), 'logs principais');

    log('done', 'smoke end-to-end concluido com sucesso');
  } finally {
    debuggerClient?.socket?.close();
    chromium?.kill('SIGTERM');
    vite?.kill('SIGTERM');
    await new Promise((resolve) => mockServer.close(() => resolve()));
    await rm(chromeProfile, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error('[e2e] falha:', error);
  process.exitCode = 1;
});
