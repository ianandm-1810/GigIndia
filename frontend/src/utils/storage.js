const TOKEN_STORAGE_KEY = 'gigindia_token'
const ROLE_STORAGE_KEY = 'gigindia_role'
const THEME_STORAGE_KEY = 'gigindia_theme'

export function getToken() {
  return window.localStorage.getItem(TOKEN_STORAGE_KEY)
}

export function saveToken(token) {
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token)
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_STORAGE_KEY)
  window.localStorage.removeItem(ROLE_STORAGE_KEY)
}

export function saveRole(role) {
  window.localStorage.setItem(ROLE_STORAGE_KEY, role)
}

export function getTheme() {
  return window.localStorage.getItem(THEME_STORAGE_KEY) || 'light'
}

export function saveTheme(theme) {
  window.localStorage.setItem(THEME_STORAGE_KEY, theme)
}
