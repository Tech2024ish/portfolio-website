/**
 * Thin fetch client for the FastAPI backend.
 *
 * In production the frontend calls same-origin `/api/...` and Vercel proxies it
 * to the backend (see vercel.json), so the owner's session cookie is first-party.
 * VITE_API_URL is only used when no proxy is available.
 */
const configured = import.meta.env.VITE_API_URL?.replace(/\/$/, '')
const useProxy = import.meta.env.VITE_API_PROXY !== 'false'
const root = !useProxy && configured ? configured.replace(/\/api$/, '') : ''

export const API_ROOT = `${root}/api`
export const API_V1 = `${API_ROOT}/v1`

export class ApiError extends Error {
  constructor(status, message, fields = [], code = 'error') {
    super(message)
    this.status = status
    this.fields = fields
    this.code = code
  }

  fieldError(name) {
    return this.fields.find((field) => field.field === name)?.message
  }
}

async function parse(response) {
  if (response.status === 204) return null
  const type = response.headers.get('content-type') || ''
  const body = type.includes('application/json') ? await response.json() : await response.text()
  if (!response.ok) {
    const error = body?.error
    throw new ApiError(
      response.status,
      error?.message || body?.detail || 'The request failed. Please try again.',
      error?.fields || [],
      error?.code,
    )
  }
  return body
}

export async function request(
  path,
  { method = 'GET', body, signal, admin = false, timeout = 20000 } = {},
) {
  const headers = {}
  if (admin || method !== 'GET') headers['X-Requested-With'] = 'portfolio-admin'
  let payload = body
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  signal?.addEventListener('abort', () => controller.abort())
  try {
    const response = await fetch(`${API_V1}${path}`, {
      method,
      headers,
      body: payload,
      credentials: 'include',
      signal: controller.signal,
    })
    return await parse(response)
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (error.name === 'AbortError' && !signal?.aborted) {
      throw new ApiError(0, 'The server took too long to respond. It may be waking up — try again.')
    }
    if (error.name === 'AbortError') throw error
    throw new ApiError(0, 'Could not reach the server. Check your connection and try again.')
  } finally {
    clearTimeout(timer)
  }
}

/** Upload with progress (fetch has no upload progress events). */
export function upload(path, file, { method = 'POST', onProgress, fields = {} } = {}) {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    form.append('file', file)
    Object.entries(fields).forEach(([key, value]) => form.append(key, value))
    const xhr = new XMLHttpRequest()
    xhr.open(method, `${API_V1}${path}`)
    xhr.withCredentials = true
    xhr.setRequestHeader('X-Requested-With', 'portfolio-admin')
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100))
    }
    xhr.onload = () => {
      let body
      try {
        body = JSON.parse(xhr.responseText)
      } catch {
        body = null
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body)
      else
        reject(
          new ApiError(
            xhr.status,
            body?.error?.message || body?.detail || 'Upload failed.',
            body?.error?.fields || [],
          ),
        )
    }
    xhr.onerror = () => reject(new ApiError(0, 'Upload failed. Check your connection.'))
    xhr.send(form)
  })
}

// ------------------------------------------------------------------ public

export const getSite = (signal) => request('/public/site', { signal, timeout: 60000 })
export const getProject = (slug, signal) =>
  request(`/public/projects/${encodeURIComponent(slug)}`, { signal })
export const getArticles = (signal) => request('/public/articles', { signal })
export const getArticle = (slug, signal) =>
  request(`/public/articles/${encodeURIComponent(slug)}`, { signal })
/**
 * The v1 contact endpoint is unavailable when the backend predates V2 (route
 * missing: 404/405) or has no database configured yet (503). In those cases the
 * original endpoint still stores the message in the legacy `contacts` table,
 * which migration 0002 imports into the inbox. Validation errors (422), rate
 * limits (429) and other failures are reported, never retried elsewhere.
 */
export const V1_CONTACT_UNAVAILABLE = [404, 405, 503]

export async function sendContact(data) {
  try {
    return await request('/contact', { method: 'POST', body: data })
  } catch (error) {
    if (!V1_CONTACT_UNAVAILABLE.includes(error.status)) throw error
    const { subject: _subject, ...legacy } = data
    const response = await fetch(`${API_ROOT}/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(legacy),
    })
    return parse(response)
  }
}
export const resumeUrl = `${API_V1}/public/resume`
