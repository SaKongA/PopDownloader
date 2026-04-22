import { AUTH_PROFILE_KEY, AUTH_SESSION_KEY } from '../constants/authStorage'

function safeParse(value, fallback = null) {
  try {
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

export function getStoredSession() {
  return safeParse(localStorage.getItem(AUTH_SESSION_KEY), null)
}

export function setStoredSession(session) {
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session))
}

export function clearStoredSession() {
  localStorage.removeItem(AUTH_SESSION_KEY)
}

export function getStoredProfile() {
  return safeParse(localStorage.getItem(AUTH_PROFILE_KEY), null)
}

export function setStoredProfile(profile) {
  localStorage.setItem(AUTH_PROFILE_KEY, JSON.stringify(profile))
}

export function clearStoredProfile() {
  localStorage.removeItem(AUTH_PROFILE_KEY)
}

export function clearStoredAuth() {
  clearStoredSession()
  clearStoredProfile()
}
