import { request, upload } from '../api'

export const UNAUTHORIZED_EVENT = 'studio:unauthorized'

// A 401 on any protected call means the session ended; tell the shell to sign out.
const guard = (path, promise) =>
  promise.catch((error) => {
    if (error.status === 401 && !path.startsWith('/auth/login') && !path.startsWith('/auth/me')) {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    }
    throw error
  })

const get = (path, signal) => guard(path, request(path, { admin: true, signal }))
const send = (method) => (path, body) => guard(path, request(path, { method, body, admin: true }))
const post = send('POST')
const patch = send('PATCH')
const put = send('PUT')
const del = send('DELETE')

const qs = (params) => {
  const search = new URLSearchParams(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  ).toString()
  return search ? `?${search}` : ''
}

export const adminApi = {
  // auth
  login: (email, password) => post('/auth/login', { email, password }),
  logout: () => post('/auth/logout'),
  me: (signal) => get('/auth/me', signal),
  changePassword: (body) => post('/auth/password', body),
  sessions: () => get('/auth/sessions'),
  revokeSession: (id) => del(`/auth/sessions/${id}`),

  // dashboard
  overview: (signal) => get('/admin/overview', signal),
  activity: (limit = 50) => get(`/admin/activity${qs({ limit })}`),
  system: () => get('/admin/system'),

  // profile
  profile: (signal) => get('/admin/profile', signal),
  updateProfile: (body) => patch('/admin/profile', body),

  // skills
  skillCategories: (signal) => get('/admin/skill-categories', signal),
  createSkillCategory: (body) => post('/admin/skill-categories', body),
  updateSkillCategory: (id, body) => patch(`/admin/skill-categories/${id}`, body),
  deleteSkillCategory: (id) => del(`/admin/skill-categories/${id}`),
  reorderSkillCategories: (ids) => post('/admin/skill-categories/reorder', { ids }),
  createSkill: (body) => post('/admin/skills', body),
  updateSkill: (id, body) => patch(`/admin/skills/${id}`, body),
  deleteSkill: (id) => del(`/admin/skills/${id}`),
  reorderSkills: (categoryId, ids) =>
    post(`/admin/skill-categories/${categoryId}/skills/reorder`, { ids }),

  // ordered collections: experiences, education, certifications
  collection: (name) => ({
    list: (signal) => get(`/admin/${name}`, signal),
    create: (body) => post(`/admin/${name}`, body),
    update: (id, body) => patch(`/admin/${name}/${id}`, body),
    remove: (id) => del(`/admin/${name}/${id}`),
    reorder: (ids) => post(`/admin/${name}/reorder`, { ids }),
  }),

  // projects
  projects: (params = {}, signal) => get(`/admin/projects${qs(params)}`, signal),
  project: (id, signal) => get(`/admin/projects/${id}`, signal),
  createProject: (body) => post('/admin/projects', body),
  updateProject: (id, body) => patch(`/admin/projects/${id}`, body),
  publishProject: (id) => post(`/admin/projects/${id}/publish`),
  unpublishProject: (id) => post(`/admin/projects/${id}/unpublish`),
  deleteProject: (id) => del(`/admin/projects/${id}`),
  reorderProjects: (ids) => post('/admin/projects/reorder', { ids }),

  // articles
  articles: (params = {}, signal) => get(`/admin/articles${qs(params)}`, signal),
  article: (id, signal) => get(`/admin/articles/${id}`, signal),
  createArticle: (body) => post('/admin/articles', body),
  updateArticle: (id, body) => patch(`/admin/articles/${id}`, body),
  publishArticle: (id) => post(`/admin/articles/${id}/publish`),
  unpublishArticle: (id) => post(`/admin/articles/${id}/unpublish`),
  deleteArticle: (id) => del(`/admin/articles/${id}`),

  // media & resume
  media: (params = {}, signal) => get(`/admin/media${qs(params)}`, signal),
  mediaItem: (id) => get(`/admin/media/${id}`),
  uploadMedia: (file, onProgress, altText = '') =>
    upload(`/admin/media${qs({ alt_text: altText })}`, file, { onProgress }),
  replaceMedia: (id, file, onProgress) =>
    upload(`/admin/media/${id}/file`, file, { method: 'PUT', onProgress }),
  updateMedia: (id, body) => patch(`/admin/media/${id}`, body),
  deleteMedia: (id) => del(`/admin/media/${id}`),
  resume: () => get('/admin/resume'),
  setResume: (mediaId) => put('/admin/resume', { media_id: mediaId }),

  // inbox
  messages: (params = {}, signal) => get(`/admin/messages${qs(params)}`, signal),
  message: (id) => get(`/admin/messages/${id}`),
  updateMessage: (id, body) => patch(`/admin/messages/${id}`, body),
  reply: (id, body) => post(`/admin/messages/${id}/replies`, body),
  retryReply: (id) => post(`/admin/replies/${id}/retry`),
}
