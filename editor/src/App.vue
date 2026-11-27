<template>
  <div class="page" :class="{ dark: theme === 'dark' }" v-if="!isPrint">
    <header class="bar">
      <div class="left">
        <span class="logo">✎</span>
        <span class="brand">文档编辑器</span>
        <span class="sep">/</span>
        <span class="file" :title="path">{{ path || '未选择文件' }}</span>
      </div>
      <div class="right">
        <span class="who" v-if="me" :title="me.owner ? '仓库拥有者，保存即直接写入' : '贡献者，保存会发起 Pull Request 等待审核'">
          <img class="av" :src="me.avatar" alt="" />
          <span class="nm">{{ me.login }}</span>
          <span class="tag" :class="me.owner ? 'ok' : 'wait'">{{ me.owner ? '拥有者' : '待审核' }}</span>
        </span>
        <span class="hint" v-if="dirty">未保存</span>
        <span class="hint ok" v-else-if="statusText">{{ statusText }}</span>
        <a class="link" v-if="prUrl" :href="prUrl" target="_blank" rel="noopener">查看 PR ↗</a>
        <span class="hint" v-if="error" style="color:#ffe08a">{{ error }}</span>

        <button class="ibtn top" type="button" title="返回（回到站点页面）" @click="askBack">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20z" />
          </svg>
        </button>
        <button class="ibtn top" type="button" :disabled="!path" title="导出 PDF（新标签打开打印页，选“另存为 PDF”）" @click="exportPdf">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="none" stroke="currentColor" stroke-width="1.6" />
            <path d="M14 2v6h6" fill="none" stroke="currentColor" stroke-width="1.6" />
            <text x="5.2" y="19" font-size="7" font-family="Arial" fill="currentColor">PDF</text>
          </svg>
        </button>
        <button class="btn" :disabled="!path || saving || !me" @click="save">
          {{ saving ? '提交中…' : (me && me.owner ? '保存' : '提交审核') }}
        </button>
      </div>
    </header>

    <div class="themebar">
      <button class="ibtn" type="button" :title="theme === 'dark' ? '编辑器：暗黑（点击切亮）' : '编辑器：明亮（点击切暗）'" @click="toggleTheme">
        <svg v-if="theme === 'dark'" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
          <path d="m17.75 4.09-2.53 1.94.91 3.06-2.63-1.81-2.63 1.81.91-3.06-2.53-1.94L12.44 4l1.06-3 1.06 3zm3.5 6.91-1.64 1.25.59 1.98-1.7-1.17-1.7 1.17.59-1.98L15.75 11l2.06-.05L18.5 9l.69 1.95zm-2.28 4.95c.83-.08 1.72 1.1 1.19 1.85-.32.45-.66.87-1.08 1.27C15.17 23 8.84 23 4.94 19.07c-3.91-3.9-3.91-10.24 0-14.14.4-.4.82-.76 1.27-1.08.75-.53 1.93.36 1.85 1.19-.27 2.86.69 5.83 2.89 8.02a9.96 9.96 0 0 0 8.02 2.89m-1.64 2.02a12.08 12.08 0 0 1-7.8-3.47c-2.17-2.19-3.33-5-3.49-7.82-2.81 3.14-2.7 7.96.31 10.98 3.02 3.01 7.84 3.12 10.98.31" />
        </svg>
        <svg v-else viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
          <path d="m3.55 19.09 1.41 1.41 1.8-1.79-1.42-1.42M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6c0-3.32-2.69-6-6-6m8 7h3v-2h-3m-2.76 7.71 1.8 1.79 1.41-1.41-1.79-1.8M20.45 5l-1.41-1.4-1.8 1.79 1.42 1.42M13 1h-2v3h2M6.76 5.39 4.96 3.6 3.55 5l1.79 1.81zM1 13h3v-2H1m12 9h-2v3h2" />
        </svg>
      </button>

      <div class="dd">
        <button class="ibtn" :class="{ act: menu === 'preview' }" type="button" @click.stop="toggleMenu('preview')"
                :title="`文档内容主题：${previewThemeName}（点击切换）`">
          <span class="gly">Aa</span>
        </button>
        <ul class="menu" v-if="menu === 'preview'" @click.stop>
          <li v-for="p in previewThemes" :key="p.id" :class="{ sel: p.id === previewTheme }" @click="setPreview(p.id)">
            <span class="dot" :style="{ background: p.color }"></span>{{ p.name }}
          </li>
        </ul>
      </div>

      <div class="dd">
        <button class="ibtn" :class="{ act: menu === 'code' }" type="button" @click.stop="toggleMenu('code')"
                :title="`代码主题：${codeTheme}（点击切换）`">
          <span class="gly mono">&lt;/&gt;</span>
        </button>
        <ul class="menu" v-if="menu === 'code'" @click.stop>
          <li v-for="c in codeThemes" :key="c" :class="{ sel: c === codeTheme }" @click="setCode(c)" class="mono-item">{{ c }}</li>
        </ul>
      </div>

      <span class="tb-tip">图标含义：太阳/月亮＝编辑器亮暗，Aa＝文档内容主题，&lt;/&gt;＝代码主题；设置记在本机</span>
    </div>

    <div class="picker" v-if="me && !path">
      <p class="tip">选择要编辑的文档（也可以在站点页点「编辑本页」直接带进来）：</p>
      <select v-model="chosen">
        <option value="" disabled>选择文档…</option>
        <option v-for="f in files" :key="f.path" :value="f.path">{{ f.title }} — {{ f.path }}</option>
      </select>
      <button class="btn" :disabled="!chosen" @click="openByPath(chosen)">打开</button>
      <p class="err" v-if="error">{{ error }}</p>
    </div>

    <main class="main" v-if="path">
      <section class="pane editor-pane">
        <MdEditor
          v-model="text"
          language="zh-CN"
          :theme="theme"
          :preview-theme="previewTheme"
          :code-theme="codeTheme"
          :toolbars="FULL_TOOLBARS"
          :footers="FULL_FOOTERS"
          :no-upload-img="true"
          :on-save="save"
        />
      </section>
    </main>

    <div class="login-mask" v-if="!me">
      <div class="login-box">
        <h3>用 GitHub 登录</h3>
        <p class="tip" v-if="!userCode">拥有者登录后可直接编辑提交；其他人登录后提交修改会发起 Pull Request，等拥有者合并。</p>
        <div v-if="userCode" class="codebox">
          <code @click="selectCode">{{ userCode }}</code>
          <button class="mini" type="button" @click="copyCode">{{ copyLabel }}</button>
        </div>
        <p class="tip small" v-if="userCode">在新标签页打开 GitHub 输入此代码并点 Authorize，这里会自动完成登录。</p>
        <div class="row">
          <a v-if="userCode" class="mini linkmini" href="https://github.com/login/device" target="_blank" rel="noopener">打开授权页 ↗</a>
          <button class="btn" v-if="!userCode" :disabled="loginBusy" @click="startLogin">
            {{ loginBusy ? '等待授权…' : 'GitHub 登录' }}
          </button>
          <button class="mini" v-if="userCode" :disabled="loginBusy" @click="startLogin">重新获取</button>
        </div>
        <p class="err" v-if="loginError">{{ loginError }}</p>
      </div>
    </div>

    <!-- 未保存提示：切换/离开前询问 -->
    <div class="leave-mask" v-if="leaveAction">
      <div class="leave-box">
        <h3>文档还没保存</h3>
        <p class="tip">{{ path }} 有未保存的修改，要先保存再离开吗？</p>
        <div class="row">
          <button class="btn" :disabled="saving || !me" @click="saveThenLeave">保存并离开</button>
          <button class="mini" type="button" @click="leaveAnyway">不保存离开</button>
          <button class="mini" type="button" @click="leaveAction = ''">取消</button>
        </div>
        <p class="err" v-if="!me">未登录无法保存，只能「不保存离开」</p>
      </div>
    </div>
  </div>

  <!-- 打印页：只渲染预览，加载后自动唤起浏览器的“打印 → 另存为 PDF” -->
  <div class="printwrap" v-else>
    <MdPreview
      language="zh-CN"
      :model-value="text"
      :theme="'light'"
      :preview-theme="previewTheme"
      :code-theme="codeTheme"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { MdEditor, MdPreview } from 'md-editor-v3'

const CLIENT_ID = 'Ov23liZFcmfLX6wLHrmi'
const OWNER = 'rainayom'
const REPO = 'RainAYOM.github.io'
const LS_TOKEN = 'mdedit.token'

const isPrint = new URLSearchParams(location.search).has('print')

const path = ref('')
const text = ref('')
const savedText = ref('')
const files = ref([])
const chosen = ref('')
const saving = ref(false)
const statusText = ref('')
const error = ref('')
const pageUrl = ref('')
const prUrl = ref('')
const me = ref(null)
const token = ref('')
const userCode = ref('')
const loginBusy = ref(false)
const loginError = ref('')
const copyLabel = ref('复制')
const leaveAction = ref('')

/* ---------- 主题 ---------- */
const PREVIEW_THEMES = [
  { id: 'default', name: '默认', color: '#3f51b5' },
  { id: 'github', name: 'github', color: '#0969da' },
  { id: 'vuepress', name: 'vuepress', color: '#3eaf7c' },
  { id: 'mk-cute', name: 'mk-cute', color: '#f28f5c' },
  { id: 'smart-blue', name: 'smart-blue', color: '#1677ff' },
  { id: 'cyanosis', name: 'cyanosis', color: '#2b90d9' }
]
const CODE_THEMES = ['atom', 'a11y', 'github', 'gradient', 'kimbie', 'paraiso', 'qtcreator', 'stackoverflow']

const theme = ref('light')
const previewTheme = ref('default')
const codeTheme = ref('github')
const menu = ref('')
const previewThemes = PREVIEW_THEMES
const codeThemes = CODE_THEMES
const previewThemeName = computed(() => {
  const hit = PREVIEW_THEMES.find((p) => p.id === previewTheme.value)
  return hit ? hit.name : previewTheme.value
})

function toggleTheme() {
  setTheme(theme.value === 'dark' ? 'light' : 'dark')
}
function setTheme(t) {
  theme.value = t
  localStorage.setItem('mdedit.theme', t)
  document.documentElement.style.colorScheme = t
  menu.value = ''
}
function setPreview(p) {
  previewTheme.value = p
  localStorage.setItem('mdedit.previewTheme', p)
  menu.value = ''
}
function setCode(c) {
  codeTheme.value = c
  localStorage.setItem('mdedit.codeTheme', c)
  menu.value = ''
}
function toggleMenu(k) {
  menu.value = menu.value === k ? '' : k
}
function closeMenu() {
  menu.value = ''
}

function selectCode() {
  const el = document.querySelector('.codebox code')
  if (!el) return
  const sel = window.getSelection()
  const range = document.createRange()
  range.selectNodeContents(el)
  sel.removeAllRanges()
  sel.addRange(range)
}

const dirty = computed(() => path.value && text.value !== savedText.value)

const previewUrl = computed(() => {
  if (!pageUrl.value) return ''
  return `http://${location.hostname}:8000${pageUrl.value}`
})

/* md-editor-v3 默认全集：标题/上下标/任务列表/行内与块级代码/mermaid/katex/
   撤回重做保存/prettier/全屏/预览/预览模式/HTML 预览/目录/GitHub */
const FULL_TOOLBARS = [
  'bold', 'underline', 'italic', 'strikeThrough', '-',
  'title', 'sub', 'sup', 'quote', 'unorderedList', 'orderedList', 'task', '-',
  'codeRow', 'code', 'link', 'image', 'table', 'mermaid', 'katex', '-',
  'revoke', 'next', 'save', '=', 'prettier', 'pageFullscreen', 'fullscreen',
  'preview', 'previewOnly', 'htmlPreview', 'catalog', 'github'
]
const FULL_FOOTERS = ['markdownTotal', '=', 'scrollSwitch']

function authHeaders(extra) {
  return { ...(extra || {}), ...(token.value ? { Authorization: `Bearer ${token.value}` } : {}) }
}

async function api(url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: authHeaders(opts.headers) })
  if (res.status === 401) throw new Error('需要登录')
  if (res.status === 403) {
    const d = await res.json().catch(() => ({}))
    const err = new Error(d.error || '没有直接写入权限')
    err.mode = d.mode
    throw err
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  const ct = res.headers.get('content-type') || ''
  return ct.includes('json') ? res.json() : res.text()
}

/* ---------- GitHub API（浏览器直连，带 token） ---------- */
async function gh(url, opts = {}) {
  const res = await fetch('https://api.github.com' + url, {
    ...opts,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token.value}`,
      ...(opts.headers || {})
    }
  })
  if (!res.ok) {
    const d = await res.json().catch(() => ({}))
    throw new Error(`GitHub ${res.status}：${d.message || ''}`)
  }
  return res.json()
}

function b64encode(str) {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  bytes.forEach((b) => { bin += String.fromCharCode(b) })
  return btoa(bin)
}

/* 非拥有者：fork → 分支 → 提交 → 提 PR */
async function submitPr(pathName, content) {
  const login = me.value.login
  statusText.value = '准备 fork…'
  await gh(`/repos/${OWNER}/${REPO}/forks`, { method: 'POST', body: JSON.stringify({}) }).catch(() => null)

  statusText.value = '等待 fork 就绪…'
  for (let i = 0; i < 20; i++) {
    try {
      const repo = await gh(`/repos/${login}/${REPO}`)
      if (repo && repo.name) break
    } catch (e) { /* 还没建好，继续等 */ }
    await new Promise((r) => setTimeout(r, 1500))
  }

  const baseBranch = 'main'
  const refData = await gh(`/repos/${login}/${REPO}/git/ref/heads/${baseBranch}`)
  const baseSha = refData.object.sha
  const branch = `edit/${pathName.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(-40)}-${Date.now().toString(36)}`

  statusText.value = '创建分支…'
  await gh(`/repos/${login}/${REPO}/git/refs`, {
    method: 'POST',
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseSha })
  })

  let sha = ''
  try {
    const cur = await gh(`/repos/${login}/${REPO}/contents/${encodeURI(pathName)}?ref=${branch}`)
    sha = cur.sha
  } catch (e) { /* 新文件 */ }

  statusText.value = '提交修改…'
  await gh(`/repos/${login}/${REPO}/contents/${encodeURI(pathName)}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: `docs: 更新 ${pathName}`,
      content: b64encode(content),
      branch,
      ...(sha ? { sha } : {})
    })
  })

  statusText.value = '发起 Pull Request…'
  const pr = await gh(`/repos/${OWNER}/${REPO}/pulls`, {
    method: 'POST',
    body: JSON.stringify({
      title: `docs: 更新 ${pathName}`,
      head: `${login}:${branch}`,
      base: baseBranch,
      body: `由网页编辑器提交的修改（${login}）。\n\n文件：${pathName}\n\n请仓库拥有者审核后合并。`
    })
  })
  return pr
}

/* ---------- 设备码登录 ---------- */
async function startLogin() {
  if (loginBusy.value) return
  loginBusy.value = true
  loginError.value = ''
  userCode.value = ''
  try {
    const r = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `client_id=${CLIENT_ID}&scope=${encodeURIComponent('public_repo read:user')}`
    })
    const d = await r.json()
    if (!d.device_code) throw new Error(d.error_description || '获取设备码失败')
    userCode.value = d.user_code
    const interval = (d.interval || 5) * 1000
    const deadline = Date.now() + (d.expires_in || 900) * 1000
    let wait = interval
    while (Date.now() < deadline) {
      await new Promise((res) => setTimeout(res, wait))
      let pd
      try {
        const pr = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `client_id=${CLIENT_ID}&device_code=${d.device_code}&grant_type=urn:ietf:params:oauth:grant-type:device_code`
        })
        pd = await pr.json()
      } catch (e) {
        continue
      }
      if (pd.access_token) {
        token.value = pd.access_token
        localStorage.setItem(LS_TOKEN, pd.access_token)
        await loadIdentity()
        userCode.value = ''
        return
      }
      if (pd.error === 'authorization_pending') continue
      if (pd.error === 'slow_down') { wait += 5000; continue }
      throw new Error(pd.error_description || pd.error)
    }
    throw new Error('设备码过期，请重新登录')
  } catch (e) {
    loginError.value = `登录失败：${e.message}`
  } finally {
    loginBusy.value = false
  }
}

async function copyCode() {
  const text = userCode.value
  let ok = false
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      ok = true
    }
  } catch (e) { /* 走兜底 */ }
  if (!ok) {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.top = '-1000px'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      ta.setSelectionRange(0, text.length)
      ok = document.execCommand('copy')
      document.body.removeChild(ta)
    } catch (e) { ok = false }
  }
  if (ok) {
    copyLabel.value = '已复制'
    setTimeout(() => (copyLabel.value = '复制'), 1500)
  } else {
    const el = document.querySelector('.codebox code')
    if (el) {
      const sel = window.getSelection()
      const range = document.createRange()
      range.selectNodeContents(el)
      sel.removeAllRanges()
      sel.addRange(range)
    }
    copyLabel.value = '已选中，Ctrl+C'
    setTimeout(() => (copyLabel.value = '复制'), 3000)
  }
}

async function loadIdentity() {
  try {
    const s = await api('./api/session')
    if (!s.auth) throw new Error('需要登录')
    me.value = { login: s.login, avatar: s.avatar, owner: s.owner }
    return true
  } catch (e) {
    me.value = null
    if (e.message === '需要登录') {
      token.value = ''
      localStorage.removeItem(LS_TOKEN)
    }
    return false
  }
}

async function loadList() {
  try {
    files.value = await api('./api/list')
  } catch (e) {
    error.value = `文档列表加载失败：${e.message}`
  }
}

async function openByUrl(url) {
  try {
    applyDoc(await api(`./api/resolve?url=${encodeURIComponent(url)}`))
  } catch (e) {
    error.value = `按地址定位失败：${e.message}`
    await loadList()
  }
}

async function openByPath(p) {
  try {
    applyDoc(await api(`./api/doc?path=${encodeURIComponent(p)}`))
  } catch (e) {
    error.value = `打开失败：${e.message}`
  }
}

function applyDoc(data) {
  path.value = data.path
  text.value = data.content
  savedText.value = data.content
  statusText.value = ''
  error.value = ''
  prUrl.value = ''
  chosen.value = data.path
  if (data.page_url) pageUrl.value = data.page_url
}

async function save() {
  if (!path.value || saving.value || !me.value) return
  saving.value = true
  error.value = ''
  prUrl.value = ''
  try {
    if (me.value.owner) {
      const data = await api('./api/doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: path.value, content: text.value })
      })
      savedText.value = text.value
      statusText.value = `已保存 ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}` + (data.bytes ? ` · ${data.bytes} 字节` : '')
    } else {
      const pr = await submitPr(path.value, text.value)
      savedText.value = text.value
      prUrl.value = pr.html_url
      statusText.value = `已提交审核 PR #${pr.number}`
    }
  } catch (e) {
    error.value = e.mode === 'pr' ? `${e.message}，请用「提交审核」` : `提交失败：${e.message}`
  } finally {
    saving.value = false
  }
}

/* ---------- 返回 / 导出 PDF / 未保存提示 ---------- */
function askBack() {
  if (dirty.value) {
    leaveAction.value = 'back'
    return
  }
  doBack()
}

function doBack() {
  leaveAction.value = ''
  if (pageUrl.value) {
    location.href = `http://${location.hostname}:8000${pageUrl.value}`
  } else if (path.value) {
    path.value = ''
    text.value = ''
    savedText.value = ''
    statusText.value = ''
    prUrl.value = ''
    loadList()
  } else {
    history.back()
  }
}

async function saveThenLeave() {
  if (!me.value || saving.value) return
  await save()
  if (!dirty.value) doBack()
}

function leaveAnyway() {
  savedText.value = text.value  // 丢掉改动，避免再次拦
  doBack()
}

function exportPdf() {
  if (!path.value) return
  const url = `./?print=1&path=${encodeURIComponent(path.value)}`
  window.open(url, '_blank')
}

function onKey(e) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault()
    save()
  }
  if (e.key === 'Escape') closeMenu()
}

function onBeforeUnload(e) {
  if (!isPrint && dirty.value) {
    e.preventDefault()
    e.returnValue = ''
  }
}

async function boot() {
  theme.value = localStorage.getItem('mdedit.theme')
    || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  previewTheme.value = localStorage.getItem('mdedit.previewTheme') || 'default'
  codeTheme.value = localStorage.getItem('mdedit.codeTheme') || 'github'
  document.documentElement.style.colorScheme = theme.value

  const hash = new URLSearchParams(location.hash.slice(1))
  const t = hash.get('t')
  if (t) {
    token.value = t
    localStorage.setItem(LS_TOKEN, t)
    history.replaceState(null, '', location.pathname + location.search)
  } else {
    token.value = localStorage.getItem(LS_TOKEN) || ''
  }

  if (isPrint) {
    await printBoot()
    return
  }

  if (token.value && (await loadIdentity())) {
    await openFromQuery()
  }
}

async function printBoot() {
  const p = new URLSearchParams(location.search).get('path') || ''
  theme.value = 'light'
  if (!p) {
    error.value = '缺少 path 参数'
    return
  }
  if (!token.value) {
    error.value = '需要先登录编辑器再导出'
    return
  }
  try {
    applyDoc(await api(`./api/doc?path=${encodeURIComponent(p)}`))
  } catch (e) {
    error.value = `导出失败：${e.message}`
    return
  }
  // 打印页专用：去掉 front matter、把 MkDocs 的 !!! admonition 转成引用块
  text.value = prepareForPrint(text.value)
  await nextTick()
  const auto = new URLSearchParams(location.search).get('autoprint') !== '0'
  if (auto) setTimeout(() => window.print(), 1200)
}

const ADO_ICON = {
  tip: '💡', note: '📝', info: 'ℹ️', warning: '⚠️', caution: '⚠️', danger: '🚨',
  success: '✅', check: '✅', question: '❓', example: '🧪', quote: '📌',
  abstract: '📋', bug: '🐞', failure: '❌', todo: '☑️'
}

/* MkDocs 的 admonition（!!! / ???）md-editor 不认，打印前转成引用块：
   > **💡 标题**
   > 内容…（嵌套的那层继续递归，输出成二级引用） */
function convertAdmonitions(src) {
  const lines = src.split('\n')
  const out = []
  let i = 0
  while (i < lines.length) {
    const m = lines[i].match(/^(?:!!!|\?\?\?)\s*([a-zA-Z-]*)(?:\s+"([^"]*)")?\s*$/)
    if (m) {
      const type = (m[1] || 'note').toLowerCase()
      const title = m[2] || ''
      const body = []
      i++
      while (i < lines.length) {
        const L = lines[i]
        if (/^\s*$/.test(L)) { body.push(''); i++; continue }
        const indent = L.match(/^\s*/)[0].length
        if (indent >= 4) { body.push(L.slice(4)); i++ }
        else break
      }
      while (body.length && body[body.length - 1] === '') body.pop()
      const inner = convertAdmonitions(body.join('\n')).split('\n')
      out.push(`> **${ADO_ICON[type] || '📌'} ${title || type}**`, '>')
      inner.forEach((l) => out.push(l ? '> ' + l : '>'))
      out.push('')
      continue
    }
    if (/^===\s*"[^"]*"\s*$/.test(lines[i])) { i++; continue }
    out.push(lines[i])
    i++
  }
  return out.join('\n')
}

function prepareForPrint(md) {
  let src = md.replace(/\r\n/g, '\n')
  const fm = src.match(/^---\n([\s\S]*?)\n---\n/)
  if (fm) src = src.slice(fm[0].length)
  return convertAdmonitions(src)
}

async function openFromQuery() {
  const sp = new URLSearchParams(location.search)
  const url = sp.get('url')
  const p = sp.get('path')
  if (url) await openByUrl(url)
  else if (p) await openByPath(p)
  else await loadList()
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  window.addEventListener('beforeunload', onBeforeUnload)
  document.addEventListener('click', closeMenu)
  boot()
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('beforeunload', onBeforeUnload)
  document.removeEventListener('click', closeMenu)
})
</script>

<style>
html, body, #app { height: 100%; margin: 0; }
body { font-family: -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; }

.page { display: flex; flex-direction: column; height: 100%; background: #f6f7fb; }

.bar {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 10px 16px; background: #3f51b5; color: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,.15); flex: 0 0 auto;
}
.bar .left { display: flex; align-items: center; gap: 8px; min-width: 0; }
.bar .right { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; }
.logo { font-size: 18px; }
.brand { font-weight: 600; white-space: nowrap; }
.sep { opacity: .6; }
.file { opacity: .9; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 34vw; }
.hint { font-size: 12px; opacity: .9; white-space: nowrap; }
.hint.ok { opacity: .95; }
.hint:first-child { color: #ffe08a; }
.link { color: #fff; font-size: 13px; text-decoration: none; border-bottom: 1px dashed rgba(255,255,255,.5); white-space: nowrap; }
.who { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; padding: 2px 8px 2px 2px; border: 1px solid rgba(255,255,255,.3); border-radius: 999px; }
.av { width: 22px; height: 22px; border-radius: 50%; object-fit: cover; background: rgba(255,255,255,.25); }
.nm { max-width: 8rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tag { font-size: 10px; padding: 1px 6px; border-radius: 999px; }
.tag.ok { background: rgba(255,255,255,.9); color: #2e7d32; }
.tag.wait { background: rgba(255,255,255,.16); color: #ffd88a; }
@media (max-width: 900px) {
  .file, .link, .nm { display: none; }
  .bar { padding: 8px 10px; }
}
.btn {
  border: 0; border-radius: 999px; padding: 7px 18px; cursor: pointer;
  background: #fff; color: #3f51b5; font-weight: 600; font-size: 13px;
}
.btn:disabled { opacity: .55; cursor: default; }

/* ---------- 图标按钮（不显示文字，只靠图标 + title 提示） ---------- */
.ibtn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; padding: 0; border: 0; border-radius: 8px;
  background: transparent; color: #333a4d; cursor: pointer;
}
.ibtn:hover { background: #eef0f8; }
.ibtn.act { background: #e6e9f9; color: #3f51b5; }
.ibtn.top { color: #fff; }
.ibtn.top:hover { background: rgba(255, 255, 255, .18); }
.ibtn:disabled { opacity: .45; cursor: default; }
.ibtn.top:disabled:hover { background: transparent; }
.gly { font-size: 15px; font-weight: 700; line-height: 1; letter-spacing: -.5px; }
.gly.mono { font-family: Consolas, "Courier New", monospace; font-size: 13px; font-weight: 600; }

.themebar {
  display: flex; align-items: center; gap: 4px; padding: 6px 12px;
  background: #fff; border-bottom: 1px solid #e3e6f0; flex: 0 0 auto;
}
.dd { position: relative; }
.menu {
  position: absolute; top: calc(100% + 4px); left: 0; min-width: 170px; margin: 0; padding: 4px;
  list-style: none; background: #fff; border: 1px solid #e0e4f0; border-radius: 8px;
  box-shadow: 0 8px 24px rgba(20, 25, 50, .16); max-height: 300px; overflow: auto; z-index: 30;
}
.menu.right { left: auto; right: 0; }
.menu li { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px; font-size: 13px; cursor: pointer; color: #333; }
.menu li:hover { background: #f0f2fb; }
.menu li.sel { color: #3f51b5; font-weight: 600; }
.menu li.mono-item { font-family: Consolas, monospace; }
.dot { width: 8px; height: 8px; border-radius: 50%; flex: 0 0 auto; }
.tb-tip { margin-left: 8px; font-size: 12px; color: #8a90a6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
@media (max-width: 1100px) { .tb-tip { display: none; } }

.page.dark { background: #14161f; color: #dfe3f2; }
.page.dark .themebar { background: #1e2130; border-bottom-color: #2c3050; }
.page.dark .ibtn { color: #c8cfe6; }
.page.dark .ibtn:hover { background: #2a3050; }
.page.dark .ibtn.act { background: #2c3560; color: #dfe4ff; }
.page.dark .ibtn.top { color: #fff; }
.page.dark .ibtn.top:hover { background: rgba(255, 255, 255, .18); }
.page.dark .menu { background: #252a3d; border-color: #39406b; box-shadow: 0 10px 30px rgba(0, 0, 0, .5); }
.page.dark .menu li { color: #cdd4ea; }
.page.dark .menu li:hover { background: #313a5e; }
.page.dark .menu li.sel { color: #9fb0ff; }
.page.dark .tb-tip { color: #79809c; }
.page.dark .pane { background: #1b1e2b; }
.page.dark .picker, .page.dark .login-box, .page.dark .leave-box { background: #1e2130; }
.page.dark .picker select { background: #14161f; color: #dfe3f2; border-color: #39406b; }
.page.dark .tip { color: #cdd4ea; }
.page.dark .login-box h3, .page.dark .leave-box h3 { color: #e6e9f6; }
.page.dark .codebox code { background: #2a3050; color: #e9ecff; }
.page.dark .mini { background: #252a3d; border-color: #39406b; color: #cdd4ea; }

.main { flex: 1 1 auto; display: flex; min-height: 0; gap: 1px; background: #dfe3ee; }
.pane { min-width: 0; background: #fff; overflow: auto; }
.editor-pane { flex: 1 1 100%; }
.editor-pane .md-editor { height: 100%; border: 0; }

.picker { margin: 48px auto; max-width: 680px; background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 6px 24px rgba(0,0,0,.08); }
.picker select { width: 100%; padding: 8px; margin: 12px 0; border-radius: 8px; border: 1px solid #ccd; }
.tip { margin: 0 0 8px; color: #333; line-height: 1.6; }
.tip.small { font-size: 12px; opacity: .75; }
.err { color: #c62828; font-size: 13px; }

.login-mask, .leave-mask {
  position: fixed; inset: 0; background: rgba(20, 24, 40, .45);
  display: flex; align-items: center; justify-content: center; z-index: 50;
}
.leave-mask { z-index: 60; }
.login-box, .leave-box {
  width: 360px; background: #fff; border-radius: 12px; padding: 22px 24px;
  box-shadow: 0 12px 40px rgba(0,0,0,.25);
}
.login-box h3, .leave-box h3 { margin: 0 0 6px; font-size: 16px; color: #222; }
.codebox { display: flex; align-items: center; gap: 10px; margin: 10px 0; }
.codebox code {
  flex: 1; text-align: center; font-family: Consolas, monospace; font-size: 20px;
  letter-spacing: .12em; padding: 8px; border-radius: 8px; background: #f1f3fa;
}
.mini { border: 1px solid #ccd; background: #fff; border-radius: 999px; padding: 5px 12px; font-size: 12px; cursor: pointer; color: #333; text-decoration: none; }
.mini:hover { border-color: #3f51b5; color: #3f51b5; }
.linkmini { border-color: #3f51b5; color: #3f51b5; }
.row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.login-box .btn { background: #3f51b5; color: #fff; }
.leave-box .row { flex-wrap: wrap; }
.leave-box .btn { background: #3f51b5; color: #fff; padding: 6px 14px; }

/* ---------- 打印页 ---------- */
.printwrap { background: #fff; min-height: 100vh; }
.printwrap .md-editor-preview { max-width: 820px; margin: 0 auto; padding: 24px 20px 40px; }

@page { size: A4; margin: 14mm 12mm; }

@media print {
  html, body, #app, .printwrap { background: #fff !important; height: auto !important; }
  .printwrap .md-editor-preview { max-width: none; padding: 0 !important; margin: 0 !important; }
  .printwrap .md-editor-preview h1,
  .printwrap .md-editor-preview h2,
  .printwrap .md-editor-preview h3,
  .printwrap .md-editor-preview h4 { break-after: avoid-page; page-break-after: avoid; }
  .printwrap .md-editor-preview pre,
  .printwrap .md-editor-preview table,
  .printwrap .md-editor-preview blockquote,
  .printwrap .md-editor-preview img { break-inside: avoid; page-break-inside: avoid; }
  .printwrap .md-editor-preview pre { white-space: pre-wrap; word-break: break-word; }
  .printwrap .md-editor-preview img { max-width: 100% !important; }
  .printwrap .md-editor-preview a { color: inherit; text-decoration: none; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
</style>
