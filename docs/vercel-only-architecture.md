# ApplyForge AI Local-First: arquitetura alvo Vercel-only

## Decisao

O app novo sera publicado na Vercel como SPA/PWA e nao tera banco de dados proprio, autenticacao propria, fila, cron, storage central ou qualquer persistencia de dados de usuario no servidor.

Tudo que for perfil, experiencias, skills, vagas salvas, analises, respostas, configuracoes e PDFs fica no navegador do proprio usuario via `IndexedDB`.

## O que isso significa na pratica

- hosting: `Vercel`
- frontend: `Vue 3 + Vite + PWA`
- persistencia: `Dexie + IndexedDB`
- backup: export/import manual em `JSON`
- PDF: gerado no navegador
- automacao: fora de escopo
- multiusuario com conta: fora de escopo
- banco de dados central: fora de escopo
- armazenamento de tokens e dados sensiveis em servidor: fora de escopo

## Limites aceitos

### 1. Sem sincronizacao entre dispositivos

Cada navegador vira um workspace separado.

Se o usuario abrir em outro computador, outro navegador, aba anonima, ou limpar os dados do site, o workspace nao acompanha automaticamente.

### 2. Sem automacao real

Como os dados vivem no navegador, a Vercel nao consegue executar buscas agendadas por usuario sem guardar estado no servidor. Como a decisao e `full Vercel` sem persistencia central, as buscas serao manuais.

### 3. Sem responsabilidade de guarda de dados do usuario

Esse e o beneficio principal do modelo:

- sem LGPD operacional de um banco proprio com dados de perfil
- sem armazenar tokens dos usuarios em base central
- sem vazamento de curriculos por storage central da aplicacao

### 4. Dependencias externas continuam existindo

O app ainda pode consumir servicos que o proprio usuario configurar, por exemplo:

- `OpenRouter`
- `Adzuna`

Isso nao cria banco proprio da plataforma, mas continua sendo dependencia de terceiros para IA e busca.

## Arquitetura recomendada

### Camada 1. Frontend publico na Vercel

- deploy estatico
- SPA com rotas do app
- PWA instalavel
- tudo carregado no navegador

### Camada 2. Workspace local no navegador

Persistir localmente:

- perfil
- experiencias
- formacao
- competencias
- configuracoes de provider
- esquemas de busca
- vagas capturadas
- analises
- respostas
- curriculos gerados
- PDFs importados e referencias de layout
- logs locais

### Camada 3. Integracoes sem banco proprio

Existem dois modos validos:

#### Opcao A. Chamada direta do navegador

Usar quando a API suportar browser com CORS adequado.

Vantagens:

- arquitetura mais simples
- nenhuma passagem de dado por funcao serverless propria

Desvantagens:

- chave pode ficar exposta no cliente
- algumas APIs bloqueiam browser direto

#### Opcao B. Proxy leve em Vercel Functions

Usar quando a API nao funcionar bem no browser ou quando quisermos evitar expor detalhes tecnicos no cliente.

Regras desse proxy:

- sem persistir request body
- sem salvar tokens em banco
- sem salvar PDFs
- sem logar payload sensivel
- apenas repassar a chamada

Isso continua sendo `Vercel-only`, desde que a funcao seja transit layer e nao banco.

## Decisao recomendada por integracao

### OpenRouter

Recomendado usar `Vercel Function` como proxy.

Motivo:

- reduz exposicao de detalhes da chamada no cliente
- centraliza timeout, tratamento de erro e normalizacao
- evita depender de comportamento CORS do browser para toda a app

Observacao:

A chave ainda sera do usuario. Ela pode ser enviada pelo navegador para a function a cada chamada, sem persistencia server-side.

### Adzuna

Recomendado usar `Vercel Function` como proxy.

Motivo:

- elimina a gambiarra de `JSONP`
- melhora erros de teste e execucao
- deixa a busca mais previsivel

### Brave

Fora de escopo no modo atual.

Motivo:

- browser direto nao atende bem
- exigiria proxy dedicado
- a busca por RSS + Adzuna resolve melhor o MVP local-first

## O que o produto passa a ser

Uma ferramenta pessoal, local-first, sem conta:

- o usuario entra
- configura suas chaves
- importa seu CV
- monta o perfil
- roda buscas manualmente
- analisa vagas
- gera CV adaptado
- exporta backup se quiser

Sem painel admin, sem area privada, sem banco, sem fila, sem automacao.

## Riscos que precisam ser aceitos

### Perda local de dados

Se o usuario limpar os dados do navegador sem exportar backup, perde o workspace.

### Limite de armazenamento do navegador

`IndexedDB` aguenta bem textos e muitos registros, mas PDFs acumulados podem crescer. Precisamos tratar:

- limpeza de curriculos antigos
- remocao manual de assets
- export/import de backup

### Chaves sensiveis no dispositivo do usuario

As chaves continuam sensiveis. Elas devem ficar:

- mascaradas na interface
- armazenadas localmente
- nunca com log completo no cliente
- nunca persistidas em banco do app

## Escopo final recomendado

### Mantemos

- dashboard local
- perfil completo
- import de PDF do LinkedIn
- import de PDF modelo de layout
- configuracao local de providers
- buscas manuais
- lista de vagas com filtros
- analise de vaga
- respostas de candidatura
- geracao de CV adaptado
- export/import de backup
- PWA

### Cortamos

- automacao por frequencia
- scheduler
- cron por usuario
- notificacoes dependentes de backend
- sincronizacao entre dispositivos
- qualquer banco central

## Proximos passos tecnicos

1. Remover ou desativar definitivamente tudo que sugere automacao.
2. Trocar integracoes sensiveis para `api/*` na Vercel quando fizer sentido.
3. Melhorar backup e restore para o usuario nao depender de um unico navegador.
4. Adicionar limpeza de assets locais e politica de retencao de PDFs.
5. Preparar deploy da SPA/PWA na Vercel.
