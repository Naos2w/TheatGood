<template>
  <section class="container catalog-page">
    <div class="eyebrow">AUDITORIUM DIRECTORY</div>
    <h1 class="page-title">探索影廳<span class="text-accent">.</span></h1>
    <p class="page-description">從官方銀幕尺寸和座位圖開始，逐步還原台灣影廳的觀影視角。</p>

    <div class="catalog-panel">
      <div class="catalog-panel__image catalog-panel__image--verified" aria-hidden="true">
        <div class="catalog-panel__screen" />
        <div class="catalog-panel__line" v-for="i in 6" :key="i" />
      </div>
      <div class="catalog-panel__details">
        <div class="eyebrow">OFFICIAL SOURCE / FIRST AUDITORIUM</div>
        <h2>國家電影及視聽文化中心・小影格</h2>
        <p>
          以官方場館設備手冊為依據，確認銀幕
          <strong>8.88 × 4.80 公尺</strong>、52 席及 A–F 排座號。 目前以估算排距與高差生成 3D
          模型，視角僅供示意。
        </p>
        <div class="catalog-tags">
          <span>官方銀幕 8.88 × 4.80 m</span>
          <span>52 席</span>
          <span>3D 幾何：估算</span>
        </div>
        <v-btn to="/auditoriums/tfai-small" color="primary" rounded="lg" class="mt-4">
          預覽影廳與座位
          <v-icon end icon="mdi-arrow-top-right" />
        </v-btn>
      </div>
    </div>

    <div class="catalog-panel catalog-panel--secondary">
      <div class="catalog-panel__image" aria-hidden="true">
        <div class="catalog-panel__screen" />
        <div class="catalog-panel__line" v-for="i in 6" :key="i" />
      </div>
      <div class="catalog-panel__details">
        <div class="eyebrow">INTERACTIVE DEMO / REFERENCE MODEL</div>
        <h2>TheatGood 示範影廳</h2>
        <p>原先的 114 席虛構模型仍保留，方便驗證各排座位與 3D 自由相機。</p>
        <div class="catalog-tags">
          <span>3D VIEWER</span>
          <span>1.90:1 示意</span>
          <span>全部尺寸：估算</span>
        </div>
        <v-btn to="/auditoriums/demo" color="primary" variant="outlined" rounded="lg" class="mt-4">
          開啟示範模型 <v-icon end icon="mdi-arrow-top-right" />
        </v-btn>
      </div>
    </div>

    <div class="coming-notice">
      <v-icon icon="mdi-information-outline" color="primary" />
      <div>
        <strong>請留意官方資料與 3D 模擬精度不同</strong>
        <p>
          目前只有小影格的銀幕尺寸與座位編號有官方來源。排距、銀幕高度、坡度、
          曲率與人眼高度尚未實測；模型不能代替現場選座確認。
        </p>
      </div>
    </div>
  </section>
</template>
