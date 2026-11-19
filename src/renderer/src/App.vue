<script setup lang="ts">
import {
  NConfigProvider,
  NMessageProvider,
  NDialogProvider,
  NNotificationProvider,
  type GlobalThemeOverrides
} from 'naive-ui'
import AppTitlebar from './components/AppTitlebar.vue'
import AppSidebar from './components/AppSidebar.vue'
import AppAssistant from './components/AppAssistant.vue'

// 亮色 baseline：与 styles/_tokens.scss 中的 CSS 变量保持同一套色值
const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#6250f0',
    primaryColorHover: '#7a6bff',
    primaryColorPressed: '#4a38d9',
    primaryColorSuppl: '#6250f0',
    infoColor: '#0d9fbf',
    successColor: '#0f9f6e',
    warningColor: '#b45309',
    errorColor: '#dc2626',
    bodyColor: '#f5f6fa',
    cardColor: '#ffffff',
    modalColor: '#ffffff',
    popoverColor: '#ffffff',
    tableColor: '#ffffff',
    inputColor: '#ffffff',
    borderColor: '#e4e8f0',
    dividerColor: '#eef1f7',
    textColorBase: '#1b2130',
    textColor1: '#1b2130',
    textColor2: '#5a6478',
    textColor3: '#8a93a6',
    borderRadius: '10px',
    fontFamily: "'Inter','Segoe UI','Microsoft YaHei',system-ui,sans-serif"
  },
  Card: { borderRadius: '14px' },
  DataTable: { thColor: '#f7f8fc', tdColor: '#ffffff', thTextColor: '#5a6478' }
}
</script>

<template>
  <n-config-provider :theme-overrides="themeOverrides">
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
            <AppAssistant />
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