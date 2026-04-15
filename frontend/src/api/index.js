import axios from 'axios'

const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api'

const api = axios.create({
  baseURL,
  timeout: 10000,
})

export const getProjects = () => api.get('/projects')
export const getSkills = () => api.get('/skills')
export const sendContact = (data) => api.post('/contact', data)
export const getVisits = () => api.get('/visits')
export const recordVisit = () => api.post('/visits')
