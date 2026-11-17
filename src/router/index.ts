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
      path: '/cinemas/:slug/halls/:hallId',
      name: 'vieshow-3d-preview',
      component: () => import('../features/viewer/VieShowEstimated3DPage.vue'),
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
  scrollBehavior(to, from) {
    if (to.hash) return { el: to.hash, top: 16 }
    // Seat and auditorium selectors store the current choice in the URL.
    // Do not bounce back to the top when only those query parameters change.
    if (to.path === from.path) return false
    return { top: 0 }
  },
})

export default router
