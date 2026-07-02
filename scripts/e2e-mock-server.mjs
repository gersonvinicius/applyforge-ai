import http from 'node:http';

const MOCK_PORT = 8787;

const server = http.createServer(async (request, response) => {
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

server.listen(MOCK_PORT, '127.0.0.1', () => {
  process.stdout.write(`[mock] listening on http://127.0.0.1:${MOCK_PORT}\n`);
});
