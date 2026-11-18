import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/dashboard' },
  { path: '/dashboard', name: 'dashboard', component: () => import('@renderer/views/DashboardView.vue'), meta: { title: '总览', icon: 'grid' } },
  { path: '/libraries', name: 'libraries', component: () => import('@renderer/views/LibrariesView.vue'), meta: { title: '受管目录', icon: 'folder' } },
  { path: '/scan', name: 'scan', component: () => import('@renderer/views/ScanView.vue'), meta: { title: '扫描', icon: 'scan' } },
  { path: '/review', name: 'review', component: () => import('@renderer/views/ReviewView.vue'), meta: { title: '待审', icon: 'checkmark' } },
  { path: '/tags', name: 'tags', component: () => import('@renderer/views/TagsView.vue'), meta: { title: '标签体系', icon: 'pricetag' } },
  { path: '/chat', name: 'chat', component: () => import('@renderer/views/ChatView.vue'), meta: { title: '对话', icon: 'chatbubbles' } },
  { path: '/settings', name: 'settings', component: () => import('@renderer/views/SettingsView.vue'), meta: { title: '设置', icon: 'settings' } }
]

export default createRouter({
  history: createWebHashHistory(),
  routes
})