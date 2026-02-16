# Agent Rules

Rules and conventions that AI agents (Claude, Ralph Loop, etc.) MUST follow when working on this codebase.

---

## 1. Nuxt Auto-Imports

**NEVER manually import Vue APIs or components.**

Nuxt automatically imports:
- Vue Composition API (`ref`, `computed`, `watch`, `onMounted`, etc.)
- Nuxt composables (`useRoute`, `useRouter`, `useFetch`, `useRuntimeConfig`, etc.)
- Components from `components/` directory

### Components Auto-Import Convention

Components are auto-imported based on their path. The folder structure becomes the component name prefix.

```
components/
├── Button.vue              → <Button />
├── ui/
│   ├── Card.vue            → <UiCard />
│   └── Modal.vue           → <UiModal />
├── form/
│   ├── Input.vue           → <FormInput />
│   └── Select.vue          → <FormSelect />
└── dashboard/
    └── stats/
        └── Chart.vue       → <DashboardStatsChart />
```

### Bad Example

```vue
<script setup lang="ts">
// WRONG - Do not import these manually
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import UiCard from '@/components/ui/Card.vue'
import FormInput from '@/components/form/Input.vue'
</script>
```

### Good Example

```vue
<script setup lang="ts">
// Just use them directly - they're auto-imported
const route = useRoute()
const count = ref(0)
const doubled = computed(() => count.value * 2)

onMounted(() => {
  console.log('Component mounted')
})
</script>

<template>
  <!-- Components are auto-imported based on path -->
  <UiCard>
    <FormInput v-model="name" />
    <DashboardStatsChart :data="chartData" />
  </UiCard>
</template>
```

---

## 2. Internationalization (i18n)

**NEVER hardcode text in templates. ALL user-facing text MUST use `t()` for localization.**

### Basic Usage

```vue
<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <!-- WRONG -->
  <h1>Welcome to our platform</h1>
  <button>Submit</button>

  <!-- CORRECT -->
  <h1>{{ t('home.title') }}</h1>
  <button>{{ t('common.submit') }}</button>
</template>
```

### Translation Files Structure

Always update locale files when adding text. Use nested keys for organization.

```json
// locales/en.json
{
  "common": {
    "submit": "Submit",
    "cancel": "Cancel",
    "save": "Save",
    "delete": "Delete",
    "loading": "Loading..."
  },
  "home": {
    "title": "Welcome to our platform",
    "description": "Build amazing products with our tools"
  },
  "errors": {
    "required": "This field is required",
    "invalid_email": "Please enter a valid email"
  }
}
```

### Arrays in i18n - Using `tm()` and `rt()`

For lists, features, or any repeating content, use arrays in JSON and loop with `tm()` (get translation messages) and `rt()` (resolve translation).

```json
// locales/en.json
{
  "pricing": {
    "title": "Pricing Plans",
    "features": [
      "Unlimited projects",
      "Priority support",
      "Advanced analytics",
      "Custom integrations"
    ]
  },
  "faq": {
    "items": [
      {
        "question": "How do I get started?",
        "answer": "Sign up with Google and follow the onboarding guide."
      },
      {
        "question": "Is there a free trial?",
        "answer": "Yes, you get 14 days free with full access."
      }
    ]
  }
}
```

```vue
<script setup lang="ts">
const { t, tm, rt } = useI18n()

// Get array of features
const features = tm('pricing.features')

// Get array of FAQ objects
const faqItems = tm('faq.items')
</script>

<template>
  <section>
    <h2>{{ t('pricing.title') }}</h2>

    <!-- Loop through simple array -->
    <ul>
      <li v-for="(feature, index) in features" :key="index">
        {{ rt(feature) }}
      </li>
    </ul>

    <!-- Loop through array of objects -->
    <div v-for="(item, index) in faqItems" :key="index" class="faq-item">
      <h3>{{ rt(item.question) }}</h3>
      <p>{{ rt(item.answer) }}</p>
    </div>
  </section>
</template>
```

### Interpolation

```json
{
  "greeting": "Hello, {name}!",
  "items_count": "You have {count} items"
}
```

```vue
<template>
  <p>{{ t('greeting', { name: user.name }) }}</p>
  <p>{{ t('items_count', { count: items.length }) }}</p>
</template>
```

---

## 3. WebSockets Over Long-Polling

**ALWAYS prefer WebSockets for real-time features. NEVER use long-polling.**

### Architecture

```
┌─────────────┐     WebSocket      ┌─────────────┐     Redis Pub/Sub    ┌─────────────┐
│   Client    │◄──────────────────►│   Server    │◄────────────────────►│    Redis    │
│   (Nuxt)    │                    │  (Node/WS)  │                      │  (Sessions) │
└─────────────┘                    └─────────────┘                      └─────────────┘
```

### Session Management with Redis

**CRITICAL: Always validate sessions and route messages to correct users.**

```typescript
// server/websocket/handler.ts
import { Redis } from 'ioredis'

const redis = new Redis(process.env.REDIS_URL)

interface WebSocketSession {
  userId: string
  socketId: string
  connectedAt: Date
}

// Store session on connect
async function onConnect(socket: WebSocket, userId: string) {
  const session: WebSocketSession = {
    userId,
    socketId: socket.id,
    connectedAt: new Date()
  }

  // Store in Redis with expiry
  await redis.setex(
    `ws:session:${socket.id}`,
    3600, // 1 hour TTL
    JSON.stringify(session)
  )

  // Map user to socket for targeted messaging
  await redis.sadd(`ws:user:${userId}`, socket.id)
}

// Remove session on disconnect
async function onDisconnect(socket: WebSocket) {
  const sessionData = await redis.get(`ws:session:${socket.id}`)
  if (sessionData) {
    const session = JSON.parse(sessionData)
    await redis.srem(`ws:user:${session.userId}`, socket.id)
  }
  await redis.del(`ws:session:${socket.id}`)
}

// Send to specific user - VALIDATE BEFORE SENDING
async function sendToUser(userId: string, event: string, data: any) {
  const socketIds = await redis.smembers(`ws:user:${userId}`)

  for (const socketId of socketIds) {
    // Verify session still exists and belongs to user
    const session = await redis.get(`ws:session:${socketId}`)
    if (session) {
      const parsed = JSON.parse(session)
      // CRITICAL: Double-check user ID matches
      if (parsed.userId === userId) {
        const socket = getSocketById(socketId)
        socket?.send(JSON.stringify({ event, data }))
      }
    }
  }
}
```

### Client-Side WebSocket Store

```typescript
// stores/websocket.ts
export const useWebSocketStore = defineStore('websocket', () => {
  const socket = ref<WebSocket | null>(null)
  const connected = ref(false)
  const authStore = useAuthStore()

  function connect() {
    if (socket.value?.readyState === WebSocket.OPEN) return

    socket.value = new WebSocket(
      `${import.meta.env.VITE_WS_URL}?token=${authStore.token}`
    )

    socket.value.onopen = () => {
      connected.value = true
    }

    socket.value.onmessage = (event) => {
      const { event: eventName, data } = JSON.parse(event.data)
      handleEvent(eventName, data)
    }

    socket.value.onclose = () => {
      connected.value = false
      // Reconnect after delay
      setTimeout(connect, 3000)
    }
  }

  function send(event: string, data: any) {
    if (socket.value?.readyState === WebSocket.OPEN) {
      socket.value.send(JSON.stringify({ event, data }))
    }
  }

  function disconnect() {
    socket.value?.close()
    socket.value = null
  }

  return { connected, connect, send, disconnect }
})
```

### Bad Example - Long-Polling

```typescript
// WRONG - Never do this
function pollForUpdates() {
  setInterval(async () => {
    const response = await $fetch('/api/updates')
    // Process updates...
  }, 5000)
}
```

---

## 4. Reusable Components

**ALWAYS create reusable components. Avoid duplicating UI code.**

### When to Extract a Component

- Used in 2+ places
- Has distinct, self-contained functionality
- Has more than ~30 lines of template code
- Represents a UI pattern (cards, modals, forms)

### Component Design Principles

```vue
<!-- components/ui/Card.vue -->
<script setup lang="ts">
// 1. Clear, typed props with defaults
interface Props {
  title?: string
  subtitle?: string
  loading?: boolean
  padded?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  padded: true,
  loading: false
})

// 2. Emit typed events
const emit = defineEmits<{
  close: []
  action: [id: string]
}>()
</script>

<template>
  <!-- 3. Use slots for flexibility -->
  <div class="card" :class="{ 'p-6': padded }">
    <div v-if="$slots.header || title" class="card-header">
      <slot name="header">
        <h3 v-if="title">{{ title }}</h3>
        <p v-if="subtitle" class="text-muted">{{ subtitle }}</p>
      </slot>
    </div>

    <div v-if="loading" class="card-loading">
      <UiSpinner />
    </div>

    <div v-else class="card-body">
      <slot />
    </div>

    <div v-if="$slots.footer" class="card-footer">
      <slot name="footer" />
    </div>
  </div>
</template>
```

### Usage of Reusable Component

```vue
<template>
  <!-- Simple usage -->
  <UiCard title="User Profile">
    <p>Content here</p>
  </UiCard>

  <!-- Full customization -->
  <UiCard :loading="isLoading">
    <template #header>
      <div class="flex items-center justify-between">
        <h2>{{ t('dashboard.title') }}</h2>
        <UiButton @click="refresh">{{ t('common.refresh') }}</UiButton>
      </div>
    </template>

    <DashboardStatsChart :data="stats" />

    <template #footer>
      <UiButton variant="secondary">{{ t('common.export') }}</UiButton>
    </template>
  </UiCard>
</template>
```

### Bad Example - Duplicated Code

```vue
<!-- WRONG - This pattern repeated in multiple files -->
<template>
  <div class="p-6 bg-white">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-medium">{{ title }}</h3>
    </div>
    <div>{{ content }}</div>
  </div>
</template>
```

---

## 5. Design System

**NO shadows. NO gradients. Clean, minimalist design with pastel colors.**

### Color Palette

Use Tailwind's color system with pastel variants:

```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        // Pastel palette
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
        },
        // Soft neutrals
        surface: '#fafafa',
        muted: '#f5f5f5',
        border: '#e5e5e5',
      }
    }
  }
}
```

### Styling Rules

```vue
<template>
  <!-- WRONG - Shadows and gradients -->
  <div class="shadow-lg bg-gradient-to-r from-blue-500 to-purple-500">
    <button class="shadow-md hover:shadow-xl">Click me</button>
  </div>

  <!-- CORRECT - Clean, flat design -->
  <div class="bg-primary-50 border border-primary-100">
    <button class="bg-primary-100 hover:bg-primary-200 border border-primary-200">
      Click me
    </button>
  </div>
</template>
```

### Design Principles

| Do | Don't |
|-----|-------|
| Flat, solid backgrounds | Drop shadows |
| Subtle borders for depth | Gradients |
| Pastel color fills | Bold/neon colors |
| Generous whitespace | Cramped layouts |
| Simple hover states (color change) | Complex hover animations |
| Clean typography | Decorative fonts |

### Component Examples

```vue
<!-- Card - flat with subtle border -->
<div class="bg-white border border-neutral-200 p-6">
  <h3 class="text-neutral-900 font-medium">{{ t('card.title') }}</h3>
</div>

<!-- Button - pastel fill -->
<button class="bg-primary-100 text-primary-700 px-4 py-2 border border-primary-200 hover:bg-primary-200">
  {{ t('common.submit') }}
</button>

<!-- Alert - soft background -->
<div class="bg-amber-50 border border-amber-200 text-amber-800 p-4">
  {{ t('alerts.warning') }}
</div>

<!-- Input - minimal styling -->
<input
  class="w-full px-3 py-2 border border-neutral-300 bg-white focus:border-primary-400 focus:outline-none"
  type="text"
/>
```

---

## 6. Authentication

**ALWAYS use Google SSO. JWT stored in Pinia with persisted localStorage.**

### Auth Store

```typescript
// stores/auth.ts
interface User {
  id: string
  email: string
  name: string
  avatar: string
}

interface AuthState {
  token: string | null
  user: User | null
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null)
  const user = ref<User | null>(null)

  const isAuthenticated = computed(() => !!token.value && !!user.value)

  async function signInWithGoogle() {
    // Redirect to Google OAuth
    const redirectUrl = `${window.location.origin}/auth/callback`
    window.location.href = `/api/auth/google?redirect=${redirectUrl}`
  }

  async function handleCallback(code: string) {
    const response = await $fetch<{ token: string; user: User }>('/api/auth/callback', {
      method: 'POST',
      body: { code }
    })

    token.value = response.token
    user.value = response.user
  }

  function signOut() {
    token.value = null
    user.value = null
    navigateTo('/login')
  }

  // Decode JWT to check expiry
  function isTokenExpired(): boolean {
    if (!token.value) return true

    try {
      const payload = JSON.parse(atob(token.value.split('.')[1]))
      return payload.exp * 1000 < Date.now()
    } catch {
      return true
    }
  }

  return {
    token,
    user,
    isAuthenticated,
    signInWithGoogle,
    handleCallback,
    signOut,
    isTokenExpired
  }
}, {
  persist: {
    storage: piniaPluginPersistedstate.localStorage,
    pick: ['token', 'user']
  }
})
```

### Login Page

```vue
<!-- pages/login.vue -->
<script setup lang="ts">
const { t } = useI18n()
const authStore = useAuthStore()

// Redirect if already authenticated
if (authStore.isAuthenticated) {
  navigateTo('/dashboard')
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-neutral-50">
    <div class="bg-white border border-neutral-200 p-8 w-full max-w-md">
      <h1 class="text-2xl font-medium text-center mb-8">
        {{ t('auth.sign_in') }}
      </h1>

      <!-- Google SSO - Only authentication method -->
      <button
        class="w-full flex items-center justify-center gap-3 bg-white border border-neutral-300 px-4 py-3 hover:bg-neutral-50"
        @click="authStore.signInWithGoogle"
      >
        <Icon name="logos:google-icon" class="w-5 h-5" />
        {{ t('auth.continue_with_google') }}
      </button>
    </div>
  </div>
</template>
```

### Auth Middleware

```typescript
// middleware/auth.ts
export default defineNuxtRouteMiddleware((to) => {
  const authStore = useAuthStore()

  // Check authentication
  if (!authStore.isAuthenticated || authStore.isTokenExpired()) {
    authStore.signOut()
    return navigateTo('/login')
  }
})
```

### Bad Example

```typescript
// WRONG - Don't implement email/password auth
async function signIn(email: string, password: string) {
  // ...
}

// WRONG - Don't store token in cookies manually
document.cookie = `token=${token}`

// WRONG - Don't use sessionStorage
sessionStorage.setItem('token', token)
```

---

## 7. Data Flow Through Pinia

**ALL data fetching and state MUST flow through Pinia stores. No direct API calls in components.**

### Store Pattern

```typescript
// stores/projects.ts
interface Project {
  id: string
  name: string
  description: string
  createdAt: string
}

export const useProjectsStore = defineStore('projects', () => {
  // State
  const projects = ref<Project[]>([])
  const currentProject = ref<Project | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Getters
  const projectCount = computed(() => projects.value.length)
  const sortedProjects = computed(() =>
    [...projects.value].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  )

  // Actions - ALL API calls happen here
  async function fetchProjects() {
    loading.value = true
    error.value = null

    try {
      const authStore = useAuthStore()
      projects.value = await $fetch('/api/projects', {
        headers: { Authorization: `Bearer ${authStore.token}` }
      })
    } catch (e) {
      error.value = 'Failed to fetch projects'
      console.error(e)
    } finally {
      loading.value = false
    }
  }

  async function createProject(data: Partial<Project>) {
    loading.value = true
    error.value = null

    try {
      const authStore = useAuthStore()
      const newProject = await $fetch('/api/projects', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authStore.token}` },
        body: data
      })
      projects.value.push(newProject)
      return newProject
    } catch (e) {
      error.value = 'Failed to create project'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deleteProject(id: string) {
    const authStore = useAuthStore()
    await $fetch(`/api/projects/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authStore.token}` }
    })
    projects.value = projects.value.filter(p => p.id !== id)
  }

  function setCurrentProject(project: Project | null) {
    currentProject.value = project
  }

  return {
    // State
    projects,
    currentProject,
    loading,
    error,
    // Getters
    projectCount,
    sortedProjects,
    // Actions
    fetchProjects,
    createProject,
    deleteProject,
    setCurrentProject
  }
}, {
  persist: {
    pick: ['currentProject'] // Only persist what's needed
  }
})
```

### Component Usage

```vue
<script setup lang="ts">
const { t } = useI18n()
const projectsStore = useProjectsStore()

// Fetch data through store
onMounted(() => {
  projectsStore.fetchProjects()
})

// Actions through store
async function handleCreate() {
  await projectsStore.createProject({ name: newName.value })
  newName.value = ''
}
</script>

<template>
  <div>
    <UiCard :loading="projectsStore.loading">
      <template #header>
        <h2>{{ t('projects.title') }} ({{ projectsStore.projectCount }})</h2>
      </template>

      <div v-if="projectsStore.error" class="text-red-600">
        {{ projectsStore.error }}
      </div>

      <ul>
        <li v-for="project in projectsStore.sortedProjects" :key="project.id">
          {{ project.name }}
        </li>
      </ul>
    </UiCard>
  </div>
</template>
```

### Bad Example - Direct API Calls

```vue
<script setup lang="ts">
// WRONG - Don't fetch data directly in components
const { data: projects } = await useFetch('/api/projects')

// WRONG - Don't make API calls in component methods
async function deleteProject(id: string) {
  await $fetch(`/api/projects/${id}`, { method: 'DELETE' })
}
</script>
```

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                           COMPONENT                                 │
│  ┌─────────────┐                              ┌─────────────┐       │
│  │   Template  │◄───── reads state ───────────│    Store    │       │
│  │             │                              │   (Pinia)   │       │
│  │  <button    │─────── calls action ────────►│             │       │
│  │   @click>   │                              │  - state    │       │
│  └─────────────┘                              │  - getters  │       │
│                                               │  - actions  │       │
└───────────────────────────────────────────────┴──────┬──────┴───────┘
                                                       │
                                                       │ API calls
                                                       ▼
                                               ┌─────────────┐
                                               │   Backend   │
                                               │     API     │
                                               └─────────────┘
```

---

## 8. Vue File Structure

**ALWAYS use this order: template, then script, then style. Use Composition API only.**

### Correct File Structure

```vue
<!-- 1. TEMPLATE FIRST -->
<template>
  <div class="container mx-auto px-4 md:px-6 lg:px-8">
    <h1 class="text-xl md:text-2xl lg:text-3xl">
      {{ t('page.title') }}
    </h1>
    <UiCard :loading="loading">
      <p>{{ t('page.content') }}</p>
    </UiCard>
  </div>
</template>

<!-- 2. SCRIPT SECOND -->
<script setup lang="ts">
const { t } = useI18n()

const loading = ref(false)
const data = ref<string[]>([])

async function fetchData() {
  loading.value = true
  try {
    // ...
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchData()
})
</script>

<!-- 3. STYLE LAST (if needed) -->
<style scoped>
.container {
  /* Custom styles only when Tailwind isn't enough */
}
</style>
```

### Bad Example - Wrong Order

```vue
<!-- WRONG - Script before template -->
<script setup lang="ts">
const count = ref(0)
</script>

<template>
  <div>{{ count }}</div>
</template>

<!-- WRONG - Options API -->
<script>
export default {
  data() {
    return { count: 0 }
  }
}
</script>
```

---

## 9. Mobile Responsiveness

**ALL pages and components MUST be mobile-responsive. Design mobile-first.**

### Breakpoint Strategy

Use Tailwind's responsive prefixes with mobile-first approach:

| Prefix | Min-width | Target |
|--------|-----------|--------|
| (none) | 0px | Mobile (default) |
| `sm:` | 640px | Large phones |
| `md:` | 768px | Tablets |
| `lg:` | 1024px | Laptops |
| `xl:` | 1280px | Desktops |

### Layout Patterns

```vue
<template>
  <!-- Responsive container -->
  <div class="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">

    <!-- Responsive grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
      <UiCard v-for="item in items" :key="item.id">
        {{ item.name }}
      </UiCard>
    </div>

    <!-- Responsive flex -->
    <div class="flex flex-col md:flex-row gap-4">
      <aside class="w-full md:w-64 lg:w-80">
        <!-- Sidebar -->
      </aside>
      <main class="flex-1">
        <!-- Content -->
      </main>
    </div>

    <!-- Responsive text -->
    <h1 class="text-2xl md:text-3xl lg:text-4xl font-medium">
      {{ t('page.title') }}
    </h1>

    <!-- Hide/show based on screen -->
    <nav class="hidden md:flex">
      <!-- Desktop nav -->
    </nav>
    <button class="md:hidden">
      <!-- Mobile menu toggle -->
      <Menu class="w-6 h-6" />
    </button>
  </div>
</template>
```

### Responsive Component Example

```vue
<!-- components/ui/DataTable.vue -->
<template>
  <!-- Desktop: Table view -->
  <table class="hidden md:table w-full">
    <thead>
      <tr class="border-b border-neutral-200">
        <th v-for="col in columns" :key="col.key" class="text-left p-3">
          {{ t(col.label) }}
        </th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="row in data" :key="row.id" class="border-b border-neutral-100">
        <td v-for="col in columns" :key="col.key" class="p-3">
          {{ row[col.key] }}
        </td>
      </tr>
    </tbody>
  </table>

  <!-- Mobile: Card view -->
  <div class="md:hidden space-y-4">
    <div
      v-for="row in data"
      :key="row.id"
      class="bg-white border border-neutral-200 p-4"
    >
      <div v-for="col in columns" :key="col.key" class="flex justify-between py-2">
        <span class="text-neutral-500">{{ t(col.label) }}</span>
        <span class="font-medium">{{ row[col.key] }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Column {
  key: string
  label: string
}

defineProps<{
  columns: Column[]
  data: Record<string, any>[]
}>()

const { t } = useI18n()
</script>
```

### Touch-Friendly Interactions

```vue
<template>
  <!-- Minimum touch target: 44x44px -->
  <button class="min-h-[44px] min-w-[44px] p-3">
    <Settings class="w-5 h-5" />
  </button>

  <!-- Adequate spacing for touch -->
  <ul class="space-y-2">
    <li v-for="item in items" :key="item.id">
      <button class="w-full text-left p-4 hover:bg-neutral-50 active:bg-neutral-100">
        {{ item.name }}
      </button>
    </li>
  </ul>
</template>
```

### Bad Example - Not Responsive

```vue
<template>
  <!-- WRONG - Fixed widths -->
  <div class="w-[800px] ml-[200px]">
    <table class="w-full"><!-- Always table, breaks on mobile --></table>
  </div>

  <!-- WRONG - Tiny touch targets -->
  <button class="p-1 text-xs">Click</button>

  <!-- WRONG - Horizontal scroll required -->
  <div class="flex gap-4">
    <div class="w-64">Fixed</div>
    <div class="w-64">Fixed</div>
    <div class="w-64">Fixed</div>
    <div class="w-64">Fixed</div>
  </div>
</template>
```

---

## 10. Database (MongoDB)

**Use MongoDB for all data persistence. Use Mongoose for schema definitions.**

### Schema Definition

```typescript
// server/models/User.ts
import { Schema, model } from 'mongoose'

interface IUser {
  googleId: string
  email: string
  name: string
  avatar: string
  createdAt: Date
  updatedAt: Date
}

const userSchema = new Schema<IUser>({
  googleId: { type: String, required: true, unique: true, index: true },
  email: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  avatar: { type: String },
}, {
  timestamps: true
})

export const User = model<IUser>('User', userSchema)
```

### API Route Pattern

```typescript
// server/api/projects/index.get.ts
import { Project } from '~/server/models/Project'

export default defineEventHandler(async (event) => {
  const user = event.context.user // From auth middleware

  const projects = await Project.find({ userId: user.id })
    .sort({ createdAt: -1 })
    .lean()

  return projects
})
```

```typescript
// server/api/projects/index.post.ts
import { Project } from '~/server/models/Project'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const body = await readBody(event)

  const project = await Project.create({
    ...body,
    userId: user.id
  })

  return project
})
```

### Connection Setup

```typescript
// server/plugins/mongodb.ts
import mongoose from 'mongoose'

export default defineNitroPlugin(async () => {
  const config = useRuntimeConfig()

  try {
    await mongoose.connect(config.mongodbUri)
    console.log('MongoDB connected')
  } catch (error) {
    console.error('MongoDB connection error:', error)
  }
})
```

### Indexing Best Practices

```typescript
// Always index fields used in queries
const projectSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  slug: { type: String, unique: true, index: true },
  status: { type: String, enum: ['draft', 'published'], index: true },
  // Compound index for common queries
})

projectSchema.index({ userId: 1, status: 1 })
projectSchema.index({ userId: 1, createdAt: -1 })
```

---

## 11. File Storage (Cloudflare R2)

**Use Cloudflare R2 for all file storage. Never store files locally or in MongoDB.**

### R2 Client Setup

```typescript
// server/utils/r2.ts
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const config = useRuntimeConfig()

export const r2Client = new S3Client({
  region: 'auto',
  endpoint: config.r2Endpoint,
  credentials: {
    accessKeyId: config.r2AccessKeyId,
    secretAccessKey: config.r2SecretAccessKey,
  },
})

export const R2_BUCKET = config.r2BucketName
```

### Upload File

```typescript
// server/api/upload.post.ts
import { r2Client, R2_BUCKET } from '~/server/utils/r2'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { nanoid } from 'nanoid'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  const formData = await readMultipartFormData(event)

  if (!formData || !formData[0]) {
    throw createError({ statusCode: 400, message: 'No file provided' })
  }

  const file = formData[0]
  const extension = file.filename?.split('.').pop() || ''
  const key = `uploads/${user.id}/${nanoid()}.${extension}`

  await r2Client.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: file.data,
    ContentType: file.type,
  }))

  // Store only the key in MongoDB, not the file
  return {
    key,
    url: `${config.public.r2PublicUrl}/${key}`
  }
})
```

### Generate Signed URL (for private files)

```typescript
// server/api/files/[key]/url.get.ts
import { r2Client, R2_BUCKET } from '~/server/utils/r2'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export default defineEventHandler(async (event) => {
  const key = getRouterParam(event, 'key')
  const user = event.context.user

  // Verify user has access to this file
  const file = await File.findOne({ key, userId: user.id })
  if (!file) {
    throw createError({ statusCode: 404, message: 'File not found' })
  }

  const signedUrl = await getSignedUrl(
    r2Client,
    new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }),
    { expiresIn: 3600 } // 1 hour
  )

  return { url: signedUrl }
})
```

### Delete File

```typescript
// server/api/files/[key].delete.ts
import { r2Client, R2_BUCKET } from '~/server/utils/r2'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'

export default defineEventHandler(async (event) => {
  const key = getRouterParam(event, 'key')
  const user = event.context.user

  // Verify ownership
  const file = await File.findOneAndDelete({ key, userId: user.id })
  if (!file) {
    throw createError({ statusCode: 404 })
  }

  await r2Client.send(new DeleteObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
  }))

  return { success: true }
})
```

### File Model (MongoDB stores metadata only)

```typescript
// server/models/File.ts
const fileSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  key: { type: String, required: true, unique: true }, // R2 object key
  filename: { type: String, required: true },
  contentType: { type: String, required: true },
  size: { type: Number, required: true },
}, {
  timestamps: true
})
```

### Environment Variables

```bash
# .env
R2_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=your-bucket
NUXT_PUBLIC_R2_PUBLIC_URL=https://your-bucket.your-domain.com
```

### Bad Example

```typescript
// WRONG - Storing files in MongoDB
const fileSchema = new Schema({
  data: Buffer, // Never do this
  content: String, // Or this (base64)
})

// WRONG - Storing locally
import fs from 'fs'
fs.writeFileSync(`./uploads/${filename}`, buffer)
```

---

## 12. SEO Optimization

**ALL pages MUST have proper SEO meta tags, localized for each language. Generate sitemaps automatically.**

### Nuxt SEO Configuration

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: [
    '@nuxtjs/i18n',
    '@nuxtjs/sitemap',
    'nuxt-og-image', // Optional: auto-generate OG images
  ],

  site: {
    url: 'https://yourdomain.com',
    name: 'Your Site Name',
  },

  sitemap: {
    sources: ['/api/__sitemap__/urls'],
    xslColumns: [
      { label: 'URL', width: '50%' },
      { label: 'Last Modified', select: 'sitemap:lastmod', width: '25%' },
      { label: 'Hreflang', select: 'count(xhtml:link)', width: '25%' },
    ],
  },

  // Default meta for all pages
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'format-detection', content: 'telephone=no' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
      ],
    },
  },
})
```

### Page-Level SEO with i18n

**EVERY page MUST define localized meta tags using `useHead` and `useSeoMeta`.**

```vue
<!-- pages/pricing.vue -->
<template>
  <div class="px-4 md:px-6 lg:px-8 max-w-7xl mx-auto py-12">
    <h1 class="text-2xl md:text-3xl lg:text-4xl font-medium mb-8">
      {{ t('pricing.title') }}
    </h1>
    <!-- Page content -->
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()

// SEO Meta - ALWAYS localized
useSeoMeta({
  title: () => t('pricing.meta.title'),
  description: () => t('pricing.meta.description'),
  ogTitle: () => t('pricing.meta.title'),
  ogDescription: () => t('pricing.meta.description'),
  ogImage: '/images/og/pricing.png',
  ogType: 'website',
  twitterCard: 'summary_large_image',
  twitterTitle: () => t('pricing.meta.title'),
  twitterDescription: () => t('pricing.meta.description'),
})

// Canonical and alternate language links
useHead({
  link: [
    { rel: 'canonical', href: `https://yourdomain.com${localePath('/pricing')}` },
  ],
})
</script>
```

### Translation File Structure for SEO

```json
// locales/en.json
{
  "pricing": {
    "title": "Pricing Plans",
    "meta": {
      "title": "Pricing Plans | Your Site Name",
      "description": "Choose the perfect plan for your needs. Start free and scale as you grow."
    }
  },
  "home": {
    "title": "Welcome",
    "meta": {
      "title": "Your Site Name - Build Amazing Products",
      "description": "The all-in-one platform to build, deploy, and scale your applications."
    }
  },
  "about": {
    "title": "About Us",
    "meta": {
      "title": "About Us | Your Site Name",
      "description": "Learn about our mission, team, and the story behind Your Site Name."
    }
  }
}
```

```json
// locales/fr.json
{
  "pricing": {
    "title": "Nos Tarifs",
    "meta": {
      "title": "Nos Tarifs | Your Site Name",
      "description": "Choisissez le forfait parfait pour vos besoins. Commencez gratuitement."
    }
  }
}
```

### Reusable SEO Composable

```typescript
// composables/useSeo.ts
interface SeoOptions {
  titleKey: string
  descriptionKey: string
  image?: string
  type?: 'website' | 'article'
  publishedTime?: string
  modifiedTime?: string
  author?: string
}

export function useSeo(options: SeoOptions) {
  const { t } = useI18n()
  const route = useRoute()
  const localePath = useLocalePath()
  const config = useRuntimeConfig()

  const baseUrl = config.public.siteUrl

  useSeoMeta({
    title: () => t(options.titleKey),
    description: () => t(options.descriptionKey),
    ogTitle: () => t(options.titleKey),
    ogDescription: () => t(options.descriptionKey),
    ogImage: options.image || `${baseUrl}/images/og-default.png`,
    ogType: options.type || 'website',
    ogUrl: `${baseUrl}${route.fullPath}`,
    twitterCard: 'summary_large_image',
    twitterTitle: () => t(options.titleKey),
    twitterDescription: () => t(options.descriptionKey),
    twitterImage: options.image || `${baseUrl}/images/og-default.png`,
    ...(options.type === 'article' && {
      articlePublishedTime: options.publishedTime,
      articleModifiedTime: options.modifiedTime,
      articleAuthor: options.author,
    }),
  })

  useHead({
    link: [
      { rel: 'canonical', href: `${baseUrl}${localePath(route.path)}` },
    ],
  })
}
```

### Usage of SEO Composable

```vue
<!-- pages/blog/[slug].vue -->
<template>
  <article class="px-4 md:px-6 lg:px-8 max-w-3xl mx-auto py-12">
    <h1 class="text-2xl md:text-3xl font-medium mb-4">{{ article.title }}</h1>
    <div v-html="article.content" />
  </article>
</template>

<script setup lang="ts">
const route = useRoute()
const articlesStore = useArticlesStore()

const article = await articlesStore.fetchBySlug(route.params.slug as string)

// Dynamic SEO for article pages
useSeoMeta({
  title: article.title,
  description: article.excerpt,
  ogTitle: article.title,
  ogDescription: article.excerpt,
  ogImage: article.coverImage,
  ogType: 'article',
  articlePublishedTime: article.publishedAt,
  articleModifiedTime: article.updatedAt,
  articleAuthor: article.author.name,
})
</script>
```

### Sitemap Configuration

```typescript
// server/api/__sitemap__/urls.ts
import { Project } from '~/server/models/Project'
import { Article } from '~/server/models/Article'

export default defineSitemapEventHandler(async () => {
  const config = useRuntimeConfig()

  // Static pages (automatically localized by @nuxtjs/sitemap)
  const staticPages = [
    { loc: '/', changefreq: 'daily', priority: 1.0 },
    { loc: '/pricing', changefreq: 'weekly', priority: 0.8 },
    { loc: '/about', changefreq: 'monthly', priority: 0.6 },
    { loc: '/contact', changefreq: 'monthly', priority: 0.6 },
  ]

  // Dynamic pages from database
  const articles = await Article.find({ status: 'published' })
    .select('slug updatedAt')
    .lean()

  const articleUrls = articles.map((article) => ({
    loc: `/blog/${article.slug}`,
    lastmod: article.updatedAt,
    changefreq: 'weekly',
    priority: 0.7,
  }))

  // Public projects
  const projects = await Project.find({ public: true })
    .select('slug updatedAt')
    .lean()

  const projectUrls = projects.map((project) => ({
    loc: `/projects/${project.slug}`,
    lastmod: project.updatedAt,
    changefreq: 'weekly',
    priority: 0.7,
  }))

  return [...staticPages, ...articleUrls, ...projectUrls]
})
```

### robots.txt

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  routeRules: {
    // Exclude private routes from indexing
    '/dashboard/**': { robots: 'noindex, nofollow' },
    '/settings/**': { robots: 'noindex, nofollow' },
    '/auth/**': { robots: 'noindex, nofollow' },
    '/api/**': { robots: 'noindex, nofollow' },
  },
})
```

Or create a static file:

```
// public/robots.txt
User-agent: *
Allow: /

Disallow: /dashboard/
Disallow: /settings/
Disallow: /auth/
Disallow: /api/

Sitemap: https://yourdomain.com/sitemap.xml
```

### Structured Data (JSON-LD)

```vue
<!-- pages/index.vue -->
<script setup lang="ts">
const { t } = useI18n()

useSeo({
  titleKey: 'home.meta.title',
  descriptionKey: 'home.meta.description',
})

// Organization structured data
useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Your Site Name',
        url: 'https://yourdomain.com',
        logo: 'https://yourdomain.com/logo.png',
        sameAs: [
          'https://twitter.com/yourhandle',
          'https://linkedin.com/company/yourcompany',
        ],
      }),
    },
  ],
})
</script>
```

```vue
<!-- pages/blog/[slug].vue - Article structured data -->
<script setup lang="ts">
// ... fetch article

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: article.title,
        description: article.excerpt,
        image: article.coverImage,
        datePublished: article.publishedAt,
        dateModified: article.updatedAt,
        author: {
          '@type': 'Person',
          name: article.author.name,
        },
        publisher: {
          '@type': 'Organization',
          name: 'Your Site Name',
          logo: {
            '@type': 'ImageObject',
            url: 'https://yourdomain.com/logo.png',
          },
        },
      }),
    },
  ],
})
</script>
```

### i18n SEO Integration

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  i18n: {
    baseUrl: 'https://yourdomain.com',
    defaultLocale: 'en',
    locales: [
      { code: 'en', iso: 'en-US', file: 'en.json', name: 'English' },
      { code: 'fr', iso: 'fr-FR', file: 'fr.json', name: 'Francais' },
    ],
    strategy: 'prefix_except_default',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_redirected',
      redirectOn: 'root',
    },
  },
})
```

This automatically generates:
- `hreflang` tags for language alternatives
- Localized URLs in sitemap
- Proper `lang` attribute on `<html>`

### Performance for SEO

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  // Enable SSR for SEO
  ssr: true,

  // Prerender static pages
  nitro: {
    prerender: {
      routes: ['/', '/pricing', '/about', '/contact'],
      crawlLinks: true,
    },
  },

  // Image optimization
  image: {
    provider: 'cloudflare', // Or your provider
    domains: ['yourdomain.com'],
  },

  // Performance
  experimental: {
    payloadExtraction: true,
  },
})
```

### Bad Examples

```vue
<!-- WRONG - No meta tags -->
<template>
  <div>
    <h1>Pricing</h1>
  </div>
</template>

<script setup lang="ts">
// No SEO at all!
</script>
```

```vue
<!-- WRONG - Hardcoded meta (not localized) -->
<script setup lang="ts">
useSeoMeta({
  title: 'Pricing Plans', // Should use t('pricing.meta.title')
  description: 'Check our pricing', // Should use t('pricing.meta.description')
})
</script>
```

```vue
<!-- WRONG - Missing required meta tags -->
<script setup lang="ts">
useSeoMeta({
  title: () => t('page.title'),
  // Missing: description, og tags, twitter cards
})
</script>
```

---

## Summary Checklist

Before submitting code, verify:

- [ ] No manual Vue/Nuxt imports (auto-imported)
- [ ] All text uses `t()` with locale files updated
- [ ] Arrays in i18n use `tm()` + `rt()`
- [ ] Real-time features use WebSockets (not polling)
- [ ] WebSocket sessions stored in Redis with user validation
- [ ] Reusable components extracted (no duplication)
- [ ] No shadows or gradients in design
- [ ] Auth uses Google SSO with JWT in Pinia
- [ ] All API calls in Pinia stores, not components
- [ ] Vue files ordered: template → script → style
- [ ] Mobile-responsive with Tailwind breakpoints
- [ ] Database operations use MongoDB/Mongoose
- [ ] Files stored in Cloudflare R2 (not local/MongoDB)
- [ ] Every page has localized SEO meta (title, description, OG, Twitter)
- [ ] Sitemap includes all public pages (static + dynamic)
- [ ] Structured data (JSON-LD) on key pages
- [ ] Private routes excluded from indexing
