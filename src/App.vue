<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <v-app>
    <div class="app-shell">
      <header class="site-header">
        <div class="site-header__inner">
          <RouterLink to="/" class="brand" aria-label="TheatGood 首頁">
            <span class="brand__mark" aria-hidden="true"><span /></span>
            <span class="brand__name">Theat<span>Good</span></span>
            <span class="brand__caption">TW CINEMA</span>
          </RouterLink>
          <nav class="site-nav" aria-label="主選單">
            <RouterLink to="/" class="site-nav__link">首頁</RouterLink>
            <RouterLink to="/cinemas" class="site-nav__link">探索影廳</RouterLink>
            <RouterLink to="/history" class="site-nav__link">觀影紀錄</RouterLink>
          </nav>
          <v-btn
            to="/auditoriums/tfai-small"
            color="primary"
            rounded="lg"
            size="small"
            class="header-cta"
          >
            <v-icon start icon="mdi-seat-recline-extra" />
            開始選位
          </v-btn>
        </div>
      </header>

      <main class="app-main">
        <RouterView />
      </main>

      <footer class="site-footer">
        <div class="container site-footer__inner">
          <span>TheatGood <span class="site-footer__sep">/</span> 找到你的觀影視角</span>
          <span>台灣影廳 3D 模擬 · MVP 預覽版</span>
        </div>
      </footer>
    </div>
  </v-app>
</template>
