// Run this script whenever you add new photos to Supabase:
//   node scripts/generate-gallery.js
//
// It fetches the current gallery list from your backend and writes
// frontend/public/gallery.json so the frontend loads photos statically.

const https = require('https')
const fs = require('fs')
const path = require('path')

const GALLERY_API = 'https://portfolio-ytlp.onrender.com/api/gallery'
const OUTPUT = path.join(__dirname, '..', 'frontend', 'public', 'gallery.json')

console.log('Fetching gallery from backend (server may take ~30s to wake up)...')

https.get(GALLERY_API, (res) => {
  let data = ''
  res.on('data', (chunk) => { data += chunk })
  res.on('end', () => {
    if (res.statusCode !== 200) {
      console.error(`Error: server returned ${res.statusCode}`)
      console.error(data)
      process.exit(1)
    }
    const parsed = JSON.parse(data)
    fs.writeFileSync(OUTPUT, JSON.stringify(parsed, null, 2))
    console.log(`Done! Wrote ${parsed.length} photos to frontend/public/gallery.json`)
  })
}).on('error', (err) => {
  console.error('Request failed:', err.message)
  process.exit(1)
})
