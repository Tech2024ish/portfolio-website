/**
 * Bundled copy of the public content, built from translations.js (the content the
 * site shipped with). It renders instantly and keeps the site complete when the
 * API is cold-starting or unreachable. The API response replaces it when it arrives.
 */
import { translations } from '../translations'

const en = translations.en

const pick = (lang, fn) => ({ fr: fn(translations.fr), rw: fn(translations.rw) })[lang]

const projectSlugs = ['school-management-system', 'portfolio-website', 'buzhub-platform']
const projectLinks = [
  'https://github.com/Tech2024ish/school-management-system',
  'https://github.com/Tech2024ish/portfolio-website',
  null,
]

export const fallbackSite = {
  isFallback: true,
  profile: {
    full_name: 'Jean Claude Ishimwe',
    professional_title: 'Backend Software Engineer',
    location: 'Kigali, Rwanda',
    is_available: true,
    availability_text: en.hero.availability,
    hero_title: en.hero.title,
    hero_title_accent: en.hero.titleAccent,
    hero_summary: en.hero.summary,
    about_title: en.about.title,
    about_lead: en.about.lead,
    about_body: en.about.paragraphs.join('\n\n'),
    engineering_principles: [
      {
        title: 'Architecture',
        body: 'Clear boundaries, cohesive business logic, and maintainable service structure.',
      },
      {
        title: 'Database engineering',
        body: 'Thoughtful schemas, relationships, and persistence shaped around the domain.',
      },
      {
        title: 'API design',
        body: 'Explicit contracts and RESTful interfaces that frontend teams can work with.',
      },
      {
        title: 'Engineering quality',
        body: 'An emphasis on reliability, authentication, and code that stays understandable.',
      },
    ],
    contact_intro: en.contact.intro,
    email: en.contact.email,
    phone: '+250 783 326 529',
    whatsapp: '+250783326529',
    social_links: [
      { label: 'GitHub', url: 'https://github.com/Tech2024ish' },
      { label: 'LinkedIn', url: 'https://www.linkedin.com/in/ishimwe-jean-claude-goslish/' },
    ],
    photo: null,
    resume_url: '/Resume.pdf',
    translations: Object.fromEntries(
      ['fr', 'rw'].map((lang) => [
        lang,
        pick(lang, (t) => ({
          availability_text: t.hero.availability,
          hero_title: t.hero.title,
          hero_title_accent: t.hero.titleAccent,
          hero_summary: t.hero.summary,
          about_title: t.about.title,
          about_lead: t.about.lead,
          about_body: t.about.paragraphs.join('\n\n'),
          contact_intro: t.contact.intro,
        })),
      ]),
    ),
  },
  skills: en.skills.groups.map((group, index) => ({
    id: index,
    name: group.label,
    translations: {
      fr: { name: translations.fr.skills.groups[index].label },
      rw: { name: translations.rw.skills.groups[index].label },
    },
    skills: group.skills.map((name, i) => ({ id: i, name })),
  })),
  experience: [
    ['silverland', 'silverRole', 'silverDate', 'silverBullets'],
    ['techinika', 'techRole', 'techDate', 'techBullets'],
  ].map(([org, role, date, bullets], index) => ({
    id: index,
    organization: en.experience[org],
    role: en.experience[role],
    is_current: index === 0,
    period_label: en.experience[date],
    highlights: en.experience[bullets],
    skills: [],
    translations: Object.fromEntries(
      ['fr', 'rw'].map((lang) => [
        lang,
        pick(lang, (t) => ({
          role: t.experience[role],
          period_label: t.experience[date],
          highlights: t.experience[bullets],
        })),
      ]),
    ),
  })),
  education: [
    {
      id: 0,
      institution: 'University of Rwanda',
      degree: 'Bachelor of Science',
      field_of_study: 'Computer Science',
      status: 'In progress',
      period_label: 'Expected July 2028',
      description: '',
      translations: {},
    },
  ],
  certifications: [
    { id: 0, name: 'Python Essentials', issuer: 'Cisco Networking Academy' },
    { id: 1, name: 'HTML Essentials', issuer: 'Cisco Networking Academy' },
  ],
  projects: en.projects.items.map((item, index) => ({
    id: index,
    slug: projectSlugs[index],
    title: item.title,
    category: item.type,
    summary: item.description,
    tech_stack: item.stack,
    github_url: projectLinks[index],
    live_url: index === 1 ? 'https://goslish.vercel.app' : null,
    is_featured: index < 2,
    problem: '',
    approach: '',
    architecture: '',
    challenges: '',
    outcome: '',
    images: [],
    thumbnail: null,
    translations: Object.fromEntries(
      ['fr', 'rw'].map((lang) => [
        lang,
        pick(lang, (t) => ({
          title: t.projects.items[index].title,
          category: t.projects.items[index].type,
          summary: t.projects.items[index].description,
        })),
      ]),
    ),
  })),
  articles: [],
}
