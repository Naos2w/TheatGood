<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="home-page">
    <section class="container home-hero">
      <div class="home-hero__copy">
        <div class="eyebrow"><span class="eyebrow__dot" /> THE NEXT WAY TO WATCH</div>
        <h1>好位置，<br /><span>決定好電影。</span></h1>
        <p class="hero-description">
          不再只憑座位表猜測視角。選好影廳與座位，<br class="desktop-only" />
          從你的視線出發，先看看銀幕在眼前的模樣。
        </p>
        <div class="home-actions">
          <v-btn
            to="/auditoriums/demo"
            color="primary"
            size="x-large"
            rounded="lg"
            class="primary-action"
          >
            體驗 3D 選位
            <v-icon end icon="mdi-arrow-top-right" />
          </v-btn>
          <RouterLink to="/cinemas" class="secondary-action">
            探索影廳 <v-icon icon="mdi-arrow-right" size="small" />
          </RouterLink>
        </div>
        <div class="hero-note">
          <v-icon icon="mdi-information-outline" size="small" />
          現階段提供示範模型，並非真實影廳測量資料。
        </div>
      </div>
      <div class="hero-art" aria-hidden="true">
        <div class="hero-art__glow" />
        <div class="hero-art__screen">
          <span>EVERY SEAT<br />HAS A STORY</span>
        </div>
        <div class="hero-art__seat-grid">
          <div
            v-for="n in 48"
            :key="n"
            class="hero-art__seat"
            :class="{ 'hero-art__seat--chosen': n === 28 }"
          />
        </div>
        <div class="hero-art__badge">SEAT 07 <span>·</span> ROW E</div>
      </div>
    </section>

    <section class="container home-details">
      <div class="section-heading">
        <div>
          <div class="eyebrow">WHAT'S INSIDE</div>
          <h2>從選座到回憶，都是你的電影時光。</h2>
        </div>
        <span class="section-heading__caption">BUILT FOR CINEMA LOVERS</span>
      </div>
      <div class="feature-grid">
        <article class="feature-card">
          <div class="feature-card__number">01 / VIEW</div>
          <v-icon icon="mdi-cube-scan" size="36" color="primary" />
          <h3>3D 影廳視角</h3>
          <p>從座位圖進入 3D 模型，模擬你坐下時的銀幕角度與距離。</p>
        </article>
        <article class="feature-card">
          <div class="feature-card__number">02 / SHOWTIME</div>
          <v-icon icon="mdi-movie-open-outline" size="36" color="primary" />
          <h3>台灣放映場次</h3>
          <p>未來整合可核實的放映時間與影廳，直接連到對應模型。</p>
          <span class="feature-card__stage">NEXT PHASE</span>
        </article>
        <article class="feature-card">
          <div class="feature-card__number">03 / HISTORY</div>
          <v-icon icon="mdi-ticket-confirmation-outline" size="36" color="primary" />
          <h3>個人觀影紀錄</h3>
          <p>留住每次看的電影、日期、影廳和座位，不需評分或寫心得。</p>
          <span class="feature-card__stage">NEXT PHASE</span>
        </article>
      </div>
    </section>
  </div>
</template>
