import { getAuthStore } from './authStore.svelte.js'

let state = $state('anonymous')
let error = $state(null)
let started = $state(false)

function normalizeError(value) {
  if (!value) {
    return { message: 'Unknown boot error' }
  }
  if (typeof value === 'string') {
    return { message: value }
  }
  if (value instanceof Error) {
    return { message: value.message || 'Unknown boot error' }
  }
  if (typeof value === 'object' && 'message' in value) {
    return { message: value.message || 'Unknown boot error' }
  }
  return { message: 'Unknown boot error' }
}

async function start() {
  if (started) {
    return
  }
  started = true
  const authStore = getAuthStore()
  try {
    await authStore.initialize()
    if (!authStore.initialized) {
      error = normalizeError(authStore.error || 'Auth initialization failed')
      state = 'error'
      return
    }
    state = authStore.isAuthenticated ? 'authenticated' : 'anonymous'
  } catch (err) {
    error = normalizeError(err)
    state = 'error'
  }
}

function sync() {
  if (!started || state === 'error') {
    return
  }
  const authStore = getAuthStore()
  if (!authStore.initialized) {
    return
  }
  const nextState = authStore.isAuthenticated ? 'authenticated' : 'anonymous'
  if (state !== nextState) {
    state = nextState
  }
}

export const bootStore = {
  get state() { return state },
  get error() { return error },
  start,
  sync
}
