import { useEffect, useState } from 'react'

export function hasSessionDraft(key) {
  try {
    return window.sessionStorage.getItem(key) !== null
  } catch {
    return false
  }
}

export function readSessionDraft(key, fallback) {
  try {
    const saved = window.sessionStorage.getItem(key)
    if (saved !== null) return JSON.parse(saved)
  } catch {
    // Continue with the supplied initial value when storage is unavailable or invalid.
  }
  return typeof fallback === 'function' ? fallback() : fallback
}

export function clearSessionDraft(key) {
  try {
    window.sessionStorage.removeItem(key)
  } catch {
    // Storage can be disabled by the browser; the in-memory form still works.
  }
}

export function useSessionDraft(key, initialValue) {
  const [value, setValue] = useState(() => readSessionDraft(key, initialValue))

  useEffect(() => {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Keep the form usable when the browser blocks storage or reaches its quota.
    }
  }, [key, value])

  return [value, setValue]
}
