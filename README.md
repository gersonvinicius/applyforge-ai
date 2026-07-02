# ApplyForge AI

Scaffold inicial do rebuild local-first do ApplyForge AI.

## Direcao desta base

- `Vue 3 + TypeScript + Vite`
- `Pinia` para estado
- `Dexie/IndexedDB` para persistencia local
- `PWA` para instalacao no dispositivo
- deploy na `Vercel`
- sem backend de negocio proprio
- sem banco central
- sem armazenamento server-side de tokens, perfil ou PDFs
- sem automacao por agendamento

## Arquitetura alvo

- app publicado na `Vercel`
- dados do usuario persistidos apenas no navegador
- integracoes externas chamadas pelo cliente ou por `Vercel Functions` sem persistencia server-side
- nenhum dado de perfil, token ou CV salvo em banco central da plataforma

Documento de referencia: docs/vercel-only-architecture.md
## O que este scaffold ja entrega

- base SPA/PWA pronta para ser a raiz do projeto
- shell visual inicial
- rotas SPA
- schema Dexie inicial
- store de workspace
- seed local para desenvolvimento
- export de backup JSON
- paginas base para Dashboard, Perfil, Vagas, Buscas, Configuracoes e Logs

## O que ainda nao entrega

- formularios reais
- providers de IA
- import de PDF do LinkedIn
- parser de layout PDF
- geracao de CV/PDF
- importacao de vagas por RSS/Adzuna
- restore de backup
- workers

## Estrutura

```txt
/
  public/
  src/
    app/
    components/
    db/
    domain/
    features/
    router/
    stores/
    styles/
    utils/
```

## Proximos passos

1. Instalar dependencias na raiz do projeto.
2. Validar build e PWA.
3. Implementar Sprint 1 completa.
4. Implementar Sprint 2 com import/export e migrations locais.

## Comandos esperados

```bash
npm install
npm run dev
npm run build
```

## Observacao

Esta base agora e a aplicacao principal do projeto. Nada nela depende do backend Laravel legado.
