<script setup lang="ts">
/**
 * 全局悬浮助手：右下角常驻，任何页面都能唤起。
 * 本版只做 UI 层——消息、快捷指令、输入回显都是前端状态，不接模型、不调 IPC。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ChatbubblesOutline, CloseOutline, SendOutline } from '@vicons/ionicons5'

interface Msg {
  role: 'user' | 'assistant'
  text: string
  time: string
}

interface PageHint {
  title: string
  quick: string[]
}

// 每个页面一套话术：助手跟着你当前在干什么
const PAGES: Record<string, PageHint> = {
  dashboard: {
    title: '总览',
    quick: ['这些数字是怎么算出来的？', '帮我加一个受管目录', '先整理哪块硬盘？']
  },
  libraries: {
    title: '受管目录',
    quick: ['这个目录怎么绑标签体系？', '移动硬盘离线了怎么办？', '一个目录能跨多个体系吗？']
  },
  scan: {
    title: '扫描',
    quick: ['开始扫描前要注意什么？', '扫描会改动我的文件吗？', '扫到一半能停吗？']
  },
  review: {
    title: '待审',
    quick: ['这条为什么被判为重复？', '批量删除安全吗？', '能先看执行前的对比吗？']
  },
  tags: {
    title: '标签体系',
    quick: ['帮我重新设计一套体系', '规则标签和语义标签的区别？', '标签太多记不住怎么办？']
  },
  settings: {
    title: '设置',
    quick: ['怎么接入自己的模型？', '我的数据存在哪里？', '不配模型还能用吗？']
  }
}

const route = useRoute()
const open = ref(false)
const draft = ref('')
const thinking = ref(false)
const listEl = ref<HTMLElement | null>(null)

const msgs = ref<Msg[]>([
  {
    role: 'assistant',
    text: '我是你的资源管家助手，会跟着你所在的页面给建议。\n\n可以让我：\n· 扫描目录、生成台账\n· 设计或调整标签体系\n· 找重复、损坏、很久没动过的资源\n\n移动和删除都要你确认，我只出方案。',
    time: '刚刚'
  }
])

const pageHint = computed<PageHint>(() => {
  const name = String(route.name ?? '')
  return PAGES[name] ?? { title: '当前页面', quick: [] }
})

async function scrollBottom(): Promise<void> {
  await nextTick()
  if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight
}

async function send(text?: string): Promise<void> {
  const content = (text ?? draft.value).trim()
  if (!content || thinking.value) return
  draft.value = ''
  msgs.value.push({ role: 'user', text: content, time: '刚刚' })
  await scrollBottom()

  thinking.value = true
  window.setTimeout(async () => {
    msgs.value.push({
      role: 'assistant',
      text: `收到。你现在在「${pageHint.value.title}」页。\n\n本版只做了界面，对话能力会在阶段 2 接上模型；届时我会读台账、按这个页面给你可执行的方案。`,
      time: '刚刚'
    })
    thinking.value = false
    await scrollBottom()
  }, 700)
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && open.value) open.value = false
}

watch(open, (v) => {
  if (v) void scrollBottom()
})

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="assistant">
    <transition name="panel">
      <section v-if="open" class="panel" role="dialog" aria-label="资源管家助手">
        <header class="head">
          <div class="avatar">AI</div>
          <div class="head-text">
            <div class="name">资源管家助手</div>
            <div class="ctx">正在看 · {{ pageHint.title }}</div>
          </div>
          <button class="icon-btn" title="收起 (Esc)" @click="open = false">
            <CloseOutline />
          </button>
        </header>

        <div ref="listEl" class="list">
          <div v-for="(m, i) in msgs" :key="i" class="msg" :class="m.role">
            <div class="avatar mini">{{ m.role === 'user' ? '你' : 'AI' }}</div>
            <div class="bubble">
              <div class="text">{{ m.text }}</div>
              <div class="time">{{ m.time }}</div>
            </div>
          </div>
          <div v-if="thinking" class="msg assistant">
            <div class="avatar mini">AI</div>
            <div class="bubble typing"><span /><span /><span /></div>
          </div>
        </div>

        <div v-if="pageHint.quick.length" class="quick">
          <button v-for="q in pageHint.quick" :key="q" class="chip" @click="send(q)">{{ q }}</button>
        </div>

        <footer class="composer">
          <textarea
            v-model="draft"
            class="input"
            rows="1"
            placeholder="说说你想做什么…（Enter 发送，Shift+Enter 换行）"
            @keydown.enter.exact.prevent="send()"
          />
          <button class="send" :disabled="!draft.trim()" title="发送" @click="send()">
            <SendOutline />
          </button>
        </footer>
      </section>
    </transition>

    <button
      class="fab"
      :class="{ on: open }"
      :title="open ? '收起助手 (Esc)' : '打开助手'"
      @click="open = !open"
    >
      <CloseOutline v-if="open" />
      <ChatbubblesOutline v-else />
    </button>
  </div>
</template>

<style scoped>
.panel {
  position: fixed;
  right: 22px;
  bottom: calc(92px + var(--statusbar-h));
  z-index: 41;
  width: 392px;
  height: min(620px, calc(100vh - 116px - var(--statusbar-h)));
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-2);
  overflow: hidden;
  transform-origin: bottom right;
}

.panel-enter-active,
.panel-leave-active {
  transition: opacity 0.16s ease, transform 0.18s cubic-bezier(0.2, 0.8, 0.3, 1);
}

.panel-enter-from,
.panel-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}

.head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 12px;
  border-bottom: 1px solid var(--line-soft);
  background: var(--chat-panel-grad);
}

.avatar {
  width: 28px;
  height: 28px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  font-size: 11px;
  font-weight: 700;
  flex: 0 0 auto;
  background: linear-gradient(140deg, #6d5bf4, #0fa8c8);
  color: #fff;
}

.avatar.mini {
  width: 24px;
  height: 24px;
  border-radius: 8px;
  font-size: 10px;
  background: var(--panel-3);
  color: var(--text-2);
}

.msg.assistant .avatar.mini {
  background: linear-gradient(140deg, #6d5bf4, #0fa8c8);
  color: #fff;
}

.head-text {
  flex: 1;
  min-width: 0;
}

.name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.ctx {
  font-size: 11px;
  color: var(--text-3);
  margin-top: 1px;
}

.icon-btn {
  width: 26px;
  height: 26px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--text-3);
  cursor: pointer;
  transition: 0.15s;
}

.icon-btn:hover {
  color: var(--text);
  background: var(--hover-2);
}

.icon-btn :deep(svg) {
  width: 16px;
  height: 16px;
}

.list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 14px 12px 6px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.msg {
  display: flex;
  gap: 8px;
  max-width: 92%;
}

.msg.user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.bubble {
  border: 1px solid var(--line-soft);
  border-radius: 12px;
  padding: 9px 11px;
  background: var(--panel-3);
}

.msg.assistant .bubble {
  border-top-left-radius: 4px;
}

.msg.user .bubble {
  background: var(--accent-soft);
  border-color: rgba(98, 80, 240, 0.24);
  border-top-right-radius: 4px;
}

.text {
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12.8px;
  line-height: 1.68;
  color: var(--text);
}

.time {
  margin-top: 4px;
  font-size: 10px;
  color: var(--text-3);
  text-align: right;
}

.typing {
  display: flex;
  gap: 4px;
  padding: 13px 14px;
}

.typing span {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--text-3);
  animation: blink 1.2s infinite;
}

.typing span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes blink {
  0%,
  60%,
  100% {
    opacity: 0.25;
  }
  30% {
    opacity: 1;
  }
}

.quick {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 2px 12px 8px;
}

.chip {
  border: 1px solid var(--line);
  background: var(--hover);
  color: var(--text-2);
  border-radius: 999px;
  padding: 4px 10px;
  font: inherit;
  font-size: 11.5px;
  cursor: pointer;
  transition: 0.15s;
}

.chip:hover {
  color: var(--text);
  border-color: var(--line-strong);
  background: var(--accent-soft);
}

.composer {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  padding: 10px 12px;
  border-top: 1px solid var(--line-soft);
  background: var(--composer-bg);
}

.input {
  flex: 1;
  min-height: 34px;
  max-height: 88px;
  resize: none;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel);
  color: var(--text);
  font: inherit;
  font-size: 12.8px;
  line-height: 1.5;
  outline: none;
  transition: border-color 0.15s;
}

.input::placeholder {
  color: var(--text-3);
}

.input:focus {
  border-color: var(--accent);
}

.send {
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border: none;
  border-radius: 10px;
  background: linear-gradient(140deg, #6d5bf4, #0fa8c8);
  color: #fff;
  cursor: pointer;
  transition: 0.15s;
}

.send:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.send:not(:disabled):hover {
  filter: brightness(1.06);
}

.send :deep(svg) {
  width: 17px;
  height: 17px;
}

.fab {
  position: fixed;
  right: 22px;
  bottom: calc(22px + var(--statusbar-h));
  z-index: 42;
  width: 56px;
  height: 56px;
  display: grid;
  place-items: center;
  border: none;
  border-radius: 50%;
  background: linear-gradient(140deg, #6d5bf4, #0fa8c8);
  color: #fff;
  cursor: pointer;
  box-shadow: 0 10px 26px rgba(98, 80, 240, 0.38);
  transition: transform 0.18s, box-shadow 0.18s;
}

.fab:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 30px rgba(98, 80, 240, 0.44);
}

.fab.on {
  border: 1px solid var(--line);
  background: var(--panel);
  color: var(--text-2);
  box-shadow: var(--shadow-2);
}

.fab :deep(svg) {
  width: 25px;
  height: 25px;
}
</style>