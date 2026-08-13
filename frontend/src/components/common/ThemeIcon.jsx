export default function ThemeIcon({ dark }) {
  return dark ? (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3.5" />
      <path
        d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"
        strokeLinecap="round"
      />
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.7 15.3A8.5 8.5 0 0 1 8.7 3.3 8.5 8.5 0 1 0 20.7 15.3Z" />
    </svg>
  )
}
