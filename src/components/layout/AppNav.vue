<script setup lang="ts">
const items = [
  { label: 'Dashboard', hint: 'Metricas locais e eventos recentes', href: '/' },
  { label: 'Perfil', hint: 'Resumo, experiencias e competencias', href: '/perfil' },
  { label: 'Vagas', hint: 'Pipeline local de oportunidades', href: '/vagas' },
  { label: 'Buscas', hint: 'Esquemas e execucoes manuais', href: '/buscas' },
  { label: 'Configuracoes', hint: 'Providers, backup e politicas locais', href: '/configuracoes' },
  { label: 'Logs', hint: 'Rastro local de execucoes', href: '/logs' }
];
</script>

<template>
  <div>
    <div class="stack-sm">
      <span class="pill">Vercel-first local data</span>
      <div>
        <p style="margin: 0; font-size: 1.35rem; font-weight: 800;">ApplyForge AI</p>
        <p class="muted" style="margin: 8px 0 0; color: rgba(247, 239, 227, 0.7);">
          Perfil, vagas e CVs salvos no dispositivo do usuario.
        </p>
      </div>
    </div>

    <nav class="nav-list" aria-label="Navegacao principal">
      <RouterLink
        v-for="item in items"
        :key="item.href"
        :to="item.href"
        class="nav-link"
      >
        <span class="nav-label">{{ item.label }}</span>
        <span class="nav-hint">{{ item.hint }}</span>
      </RouterLink>
    </nav>
  </div>
</template>
