import { NavLink } from 'react-router'

const TABS = [
  ['/admin/profile', 'Profile & hero'],
  ['/admin/profile/skills', 'Skills'],
  ['/admin/profile/career', 'Experience & education'],
  ['/admin/profile/resume', 'Resume'],
]

export default function ProfileTabs() {
  return (
    <nav className="studio-tabs" aria-label="Profile sections">
      {TABS.map(([to, label]) => (
        <NavLink key={to} to={to} end>
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
