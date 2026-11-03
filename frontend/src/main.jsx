import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router'
import './styles/tokens.css'
import './index.css'
import './contact.css'
import './portrait.css'
import './language.css'
import './theme.css'
import './responsive.css'
import './styles/v2.css'
import { SiteContentProvider } from './content/SiteContent'
import { LanguageProvider } from './context/LanguageContext'
import { ThemeProvider } from './context/ThemeContext'
import ArticlePage from './pages/ArticlePage'
import HomePage from './pages/HomePage'
import NotFoundPage from './pages/NotFoundPage'
import ProjectPage from './pages/ProjectPage'
import ProjectsPage from './pages/ProjectsPage'
import PublicLayout from './pages/PublicLayout'
import WritingPage from './pages/WritingPage'

// The owner studio is a separate chunk, so public visitors never download it.
const AdminApp = lazy(() => import('./admin/AdminApp'))

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <BrowserRouter>
          <Routes>
            <Route
              path="/admin/*"
              element={
                <Suspense fallback={<div className="studio-loading">Loading studio…</div>}>
                  <AdminApp />
                </Suspense>
              }
            />
            <Route
              element={
                <SiteContentProvider>
                  <PublicLayout />
                </SiteContentProvider>
              }
            >
              <Route index element={<HomePage />} />
              <Route path="projects" element={<ProjectsPage />} />
              <Route path="projects/:slug" element={<ProjectPage />} />
              <Route path="writing" element={<WritingPage />} />
              <Route path="writing/:slug" element={<ArticlePage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </LanguageProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
