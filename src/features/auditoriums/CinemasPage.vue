<template>
  <section class="container catalog-page">
    <div class="eyebrow">AUDITORIUM DIRECTORY</div>
    <h1 class="page-title">探索影廳<span class="text-accent">.</span></h1>
    <p class="page-description">從每個座位的視角，重新認識電影院。</p>

    <div class="catalog-panel">
      <div class="catalog-panel__image" aria-hidden="true">
        <div class="catalog-panel__screen" />
        <div class="catalog-panel__line" v-for="i in 6" :key="i" />
      </div>
      <div class="catalog-panel__details">
        <div class="eyebrow">INTERACTIVE DEMO / 001</div>
        <h2>TheatGood 示範影廳</h2>
        <p>使用參數化幾何產生的概念模型，讓你測試不同座位與銀幕觀看視角。</p>
        <div class="catalog-tags">
          <span>3D VIEWER</span><span>1.90:1 示意</span><span>模型：估算</span>
        </div>
        <v-btn to="/auditoriums/demo" color="primary" rounded="lg" class="mt-4">
          進入影廳 <v-icon end icon="mdi-arrow-top-right" />
        </v-btn>
      </div>
    </div>
    <div class="coming-notice">
      <v-icon icon="mdi-map-marker-radius-outline" color="primary" />
      <div>
        <strong>真實台灣影廳資料正在規劃中</strong>
        <p>後續只收錄可追溯來源的尺寸與座位配置，並清楚標示實測與估算值。</p>
      </div>
    </div>
  </section>
</template>
