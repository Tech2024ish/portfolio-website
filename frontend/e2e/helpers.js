/** Shared API mocks for browser regression tests. */
export const OWNER = { email: 'owner@example.com', display_name: 'Jean Claude' }

const json = (route, status, body) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

export const ok = (route, body) => json(route, 200, body)
export const fail = (route, status, message = 'Request failed.') =>
  json(route, status, { detail: message, error: { code: 'error', message } })

const PROFILE = {
  id: 1,
  full_name: 'Jean Claude Ishimwe',
  professional_title: 'Backend Software Engineer',
  location: 'Kigali, Rwanda',
  is_available: true,
  availability_text: 'Available',
  hero_title: 'Building the systems behind',
  hero_title_accent: 'useful software.',
  hero_summary: '',
  about_title: '',
  about_lead: '',
  about_body: '',
  engineering_principles: [],
  contact_intro: '',
  email: 'owner@example.com',
  phone: '',
  whatsapp: '',
  social_links: [],
  photo: null,
  resume: null,
  og_image: null,
  seo_title: 'Jean Claude Ishimwe | Backend Software Engineer',
  seo_description: 'Backend Software Engineer in Kigali.',
  default_theme: 'dark',
  translations: {},
}

const LONG_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'

/** A signed-in studio with realistic, long content on every admin endpoint used here. */
export async function mockSignedInStudio(page, overrides = {}) {
  const calls = { logout: 0 }
  await page.route('**/api/v1/**', (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname.replace('/api/v1', '')
    const method = route.request().method()
    if (overrides[path]) return overrides[path](route, calls)
    if (path === '/auth/me') return ok(route, { user: OWNER })
    if (path === '/auth/logout' && method === 'POST') {
      calls.logout += 1
      return ok(route, { success: true })
    }
    if (path === '/admin/overview')
      return ok(route, {
        projects: { published: 4, draft: 4 },
        articles: { published: 0, draft: 1 },
        messages: { unread: 0 },
        recent_messages: [],
        recent_activity: [],
        visits: { total: null, source: 'Site visit counter' },
      })
    if (path === '/admin/profile') return ok(route, PROFILE)
    if (path === '/admin/system')
      return ok(route, {
        environment: 'production',
        email: { configured: false, provider: null },
        storage: { backend: 'supabase' },
        session_ttl_hours: 12,
      })
    if (path === '/auth/sessions')
      return ok(route, [
        {
          id: 1,
          created_at: '2026-11-03T21:00:00Z',
          last_seen_at: '2026-11-03T21:30:00Z',
          expires_at: '2026-11-04T09:00:00Z',
          ip_address: '2001:db8:85a3::8a2e:370:7334',
          user_agent: LONG_UA,
          current: true,
        },
        {
          id: 2,
          created_at: '2026-11-02T08:00:00Z',
          last_seen_at: '2026-11-02T09:00:00Z',
          expires_at: '2026-11-02T20:00:00Z',
          ip_address: '197.243.10.25',
          user_agent: LONG_UA,
          current: false,
        },
      ])
    if (path === '/admin/activity')
      return ok(
        route,
        Array.from({ length: 12 }, (_, i) => ({
          id: i + 1,
          created_at: '2026-11-03T21:00:00Z',
          actor: OWNER.email,
          action: i % 2 ? 'password_change' : 'update',
          entity_type: 'profile',
          entity_id: 1,
          summary:
            'Updated profile: about_body, engineering_principles, hero_summary, seo_description, social_links',
          ip_address: '2001:db8:85a3::8a2e:370:7334',
        })),
      )
    return fail(route, 404, 'Not found.')
  })
  return calls
}

/** Width of content that escapes the viewport horizontally (0 = no page-level overflow). */
export const pageOverflow = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
