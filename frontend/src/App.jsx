import React from 'react'
import { LanguageProvider } from './context/LanguageContext'
import { ThemeProvider } from './context/ThemeContext'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import About from './components/About'
import Services from './components/Services'
import Projects from './components/Projects'
import Skills from './components/Skills'
import Certifications from './components/Certifications'
import PhotoGallery from './components/PhotoGallery'
import Writing from './components/Writing'
import Hobbies from './components/Hobbies'
import Contact from './components/Contact'
import Footer from './components/Footer'
import BackToTop from './components/BackToTop'

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans">
          <Navbar />
          <main>
            <Hero />
            <About />
            <Services />
            <Projects />
            <Skills />
            <Certifications />
            <PhotoGallery />
            <Writing />
            <Hobbies />
            <Contact />
          </main>
          <Footer />
          <BackToTop />
        </div>
      </LanguageProvider>
    </ThemeProvider>
  )
}

export default App
