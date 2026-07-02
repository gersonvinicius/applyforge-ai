const APP_PORT = Number(process.env.APP_PORT || '4173');
const MOCK_PORT = Number(process.env.MOCK_PORT || '8787');
const CHROME_PORT = Number(process.env.CHROME_PORT || '9222');
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
  const { evaluate, socket } = await connectToPageDebugger();

  try {
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
          },
          hasJob(jobTitle) {
            return [...document.querySelectorAll('article.entry-card')].some((item) => {
              const titleInput = [...item.querySelectorAll('input')].find((input) => input.placeholder === 'Backend PHP Developer');
              return titleInput?.value?.includes(jobTitle);
            });
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
    await waitFor(() => evaluate(`window.__codexE2E.text().includes('Provider de busca adzuna salvo neste dispositivo.')`), 'save Adzuna');
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
    await waitFor(() => evaluate(`window.__codexE2E.hasJob(${js('Mock Senior PHP Platform Engineer')})`), 'vaga importada');
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
    socket.close();
  }
}

main().catch((error) => {
  console.error('[e2e-drive] falha:', error);
  process.exitCode = 1;
});
