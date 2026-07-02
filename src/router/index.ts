import { createRouter, createWebHistory } from 'vue-router';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: () => import('@/features/dashboard/DashboardPage.vue')
    },
    {
      path: '/perfil',
      name: 'profile',
      component: () => import('@/features/profile/ProfilePage.vue')
    },
    {
      path: '/vagas',
      name: 'jobs',
      component: () => import('@/features/jobs/JobsPage.vue')
    },
    {
      path: '/buscas',
      name: 'searches',
      component: () => import('@/features/searches/SearchesPage.vue')
    },
    {
      path: '/configuracoes',
      name: 'settings',
      component: () => import('@/features/settings/SettingsPage.vue')
    },
    {
      path: '/logs',
      name: 'logs',
      component: () => import('@/features/logs/LogsPage.vue')
    }
  ]
});
