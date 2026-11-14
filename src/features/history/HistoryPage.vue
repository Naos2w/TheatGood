<template>
  <section class="container history-page">
    <div class="eyebrow">YOUR MOVIE TIMELINE</div>
    <h1 class="page-title">觀影紀錄<span class="text-accent">.</span></h1>
    <div class="empty-state">
      <div class="empty-state__icon">
        <v-icon icon="mdi-ticket-confirmation-outline" size="56" />
      </div>
      <div class="eyebrow">COMING IN PHASE 2</div>
      <h2>每一場電影，都值得留下位置。</h2>
      <p>觀影紀錄功能尚未開放。未來可保存電影、日期、影城、影廳與實際座位，無須評分或心得。</p>
      <v-btn to="/auditoriums/demo" color="primary" variant="outlined" rounded="lg">
        先體驗 3D 選位
        <v-icon end icon="mdi-arrow-right" />
      </v-btn>
    </div>
  </section>
</template>
