<script setup lang="ts">
import {
  NConfigProvider,
  NMessageProvider,
  NDialogProvider,
  NNotificationProvider,
  darkTheme,
  type GlobalThemeOverrides
} from 'naive-ui'
import AppTitlebar from './components/AppTitlebar.vue'
import AppSidebar from './components/AppSidebar.vue'

const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#7c5cff',
    primaryColorHover: '#8f74ff',
    primaryColorPressed: '#6b4bf0',
    primaryColorSuppl: '#7c5cff',
    infoColor: '#22d3ee',
    successColor: '#34d399',
    warningColor: '#fbbf24',
    errorColor: '#f87171',
    bodyColor: '#0e1015',
    cardColor: '#151821',
    modalColor: '#151821',
    popoverColor: '#1a1e29',
    tableColor: '#151821',
    inputColor: '#12151c',
    borderColor: '#262b38',
    dividerColor: '#1f2431',
    textColorBase: '#e7e9f2',
    textColor1: '#e7e9f2',
    textColor2: '#a7adc0',
    textColor3: '#6f7688',
    borderRadius: '10px',
    fontFamily: "'Inter','Segoe UI','Microsoft YaHei',system-ui,sans-serif"
  },
  Card: { borderRadius: '14px' },
  DataTable: { thColor: '#12151c', tdColor: '#151821', thTextColor: '#a7adc0' }
}
</script>

<template>
  <n-config-provider :theme="darkTheme" :theme-overrides="themeOverrides">
    <n-message-provider>
      <n-dialog-provider>
        <n-notification-provider>
          <div class="shell">
            <AppTitlebar />
            <div class="body">
              <AppSidebar />
              <main class="content">
                <router-view />
              </main>
            </div>
          </div>
        </n-notification-provider>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<style scoped>
.shell {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.body {
  flex: 1;
  display: flex;
  min-height: 0;
}

.content {
  flex: 1;
  min-width: 0;
  min-height: 0;
  position: relative;
  display: flex;
  flex-direction: column;
}
</style>