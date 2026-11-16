import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('../features/home/HomePage.vue') },
    { path: '/cinemas', redirect: '/' },
    {
      path: '/cinemas/:slug',
      name: 'chain-cinema',
      component: () => import('../features/cinemas/ChainCinemaPage.vue'),
    },
    {
      path: '/screenings',
      name: 'screenings',
      component: () => import('../features/screenings/ScreeningsPage.vue'),
    },
    {
      path: '/directory/:slug',
      name: 'directory-detail',
      component: () => import('../features/auditoriums/DirectoryHallPage.vue'),
    },
    {
      path: '/auditoriums/:auditoriumId',
      name: 'viewer',
      component: () => import('../features/viewer/ViewerPage.vue'),
    },
    {
      path: '/history',
      name: 'history',
      component: () => import('../features/history/HistoryPage.vue'),
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

export default router
