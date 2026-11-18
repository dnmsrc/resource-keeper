<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { NButton, NInput, NTag } from 'naive-ui'
import { SendOutline, SparklesOutline } from '@vicons/ionicons5'

interface Msg {
  role: 'user' | 'assistant'
  text: string
  time: string
}

const msgs = ref<Msg[]>([
  {
    role: 'assistant',
    text: '我是你的资源管家。可以让我：\n· 扫描某个目录并生成台账\n· 帮你设计标签体系（比如「你想怎么找片子？」）\n· 找重复文件、损坏文件、很久没动过的资源\n\n所有移动和删除都要你确认，我只出方案。',
    time: '刚刚'
  }
])

const draft = ref('')
const listEl = ref<HTMLElement | null>(null)
const thinking = ref(false)

const quick = ['帮我扫描 D:\\Downloads', '我该怎么分类我的资源？', '找出重复的电影']

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
      text: '（占位）收到。阶段 1 会先把「扫描 → 台账」接上，之后这里就能真的调用工具；现在这条只是界面演示。',
      time: '刚刚'
    })
    thinking.value = false
    await scrollBottom()
  }, 700)
}
</script>

<template>
  <div class="page chat-page">
    <div class="page-head">
      <div>
        <h1 class="page-title">对话</h1>
        <p class="page-sub">用自然语言下指令；AI 只提议，危险动作由你审批</p>
      </div>
      <n-tag size="small" type="success" :bordered="false">
        <template #icon><SparklesOutline /></template>
        规则模式（未配置 API）
      </n-tag>
    </div>

    <div class="chat">
      <div ref="listEl" class="list">
        <div v-for="(m, i) in msgs" :key="i" class="msg" :class="m.role">
          <div class="avatar">{{ m.role === 'user' ? '你' : 'AI' }}</div>
          <div class="bubble">
            <div class="text">{{ m.text }}</div>
            <div class="time">{{ m.time }}</div>
          </div>
        </div>
        <div v-if="thinking" class="msg assistant">
          <div class="avatar">AI</div>
          <div class="bubble typing"><span /><span /><span /></div>
        </div>
      </div>

      <div class="quick">
        <button v-for="q in quick" :key="q" class="chip" @click="send(q)">{{ q }}</button>
      </div>

      <div class="composer">
        <n-input
          v-model:value="draft"
          type="textarea"
          placeholder="告诉我你想怎么整理（Ctrl/⌘ + Enter 发送）"
          :autosize="{ minRows: 1, maxRows: 4 }"
          @keydown.enter.ctrl.prevent="send()"
          @keydown.enter.meta.prevent="send()"
        />
        <n-button type="primary" :disabled="!draft.trim()" @click="send()">
          <template #icon><SendOutline /></template>
        </n-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-page {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: linear-gradient(180deg, rgba(21, 24, 33, 0.9), rgba(14, 16, 21, 0.9));
  overflow: hidden;
}

.list {
  flex: 1;
  overflow: auto;
  padding: 18px 18px 8px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.msg {
  display: flex;
  gap: 10px;
  max-width: 78%;
}

.msg.user {
  align-self: flex-end;
  flex-direction: row-reverse;
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
}

.assistant .avatar {
  background: linear-gradient(140deg, rgba(124, 92, 255, 0.9), rgba(34, 211, 238, 0.5));
  color: #0b1220;
}

.user .avatar {
  background: var(--panel-3);
  color: var(--text-2);
}

.bubble {
  border: 1px solid var(--line-soft);
  border-radius: 12px;
  padding: 10px 13px;
  background: rgba(255, 255, 255, 0.02);
}

.user .bubble {
  background: rgba(124, 92, 255, 0.12);
  border-color: rgba(124, 92, 255, 0.28);
}

.text {
  white-space: pre-wrap;
  font-size: 13.5px;
  line-height: 1.72;
}

.time {
  margin-top: 5px;
  font-size: 10.5px;
  color: var(--text-3);
  text-align: right;
}

.typing {
  display: flex;
  gap: 4px;
  padding: 14px 16px;
}

.typing span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-3);
  animation: blink 1.2s infinite;
}

.typing span:nth-child(2) { animation-delay: 0.2s; }
.typing span:nth-child(3) { animation-delay: 0.4s; }

@keyframes blink {
  0%, 60%, 100% { opacity: 0.25; }
  30% { opacity: 1; }
}

.quick {
  display: flex;
  gap: 8px;
  padding: 4px 18px 10px;
  flex-wrap: wrap;
}

.chip {
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.02);
  color: var(--text-2);
  border-radius: 999px;
  padding: 5px 11px;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: 0.15s;
}

.chip:hover {
  color: var(--text);
  border-color: var(--panel-3);
  background: rgba(124, 92, 255, 0.1);
}

.composer {
  display: flex;
  gap: 10px;
  align-items: flex-end;
  padding: 12px 14px;
  border-top: 1px solid var(--line-soft);
  background: rgba(10, 12, 17, 0.6);
}
</style>