import axios from 'axios'

const configuredApiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '')
const baseURL = configuredApiUrl
  ? `${configuredApiUrl}${configuredApiUrl.endsWith('/api') ? '' : '/api'}`
  : '/api'

const api = axios.create({
  baseURL,
  timeout: 10000,
})

export const sendContact = (data) => api.post('/contact', data)
