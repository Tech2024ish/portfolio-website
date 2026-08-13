# Jean Claude Ishimwe Portfolio

Professional portfolio for Jean Claude Ishimwe, Backend Developer at SilverLandTech and Computer Science student at the University of Rwanda.

## Stack

- Frontend: React 18, Vite, CSS, Axios
- Backend: FastAPI, Supabase/PostgreSQL

## Run locally

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Backend:

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

## Frontend structure

```text
frontend/src/
├── components/       # Page sections and shared UI pieces
├── context/          # Theme and language state
├── api/              # Backend API client
├── images/           # Source image assets
├── App.jsx           # Page composition and shared page state
├── main.jsx          # Application entry point
└── translations.js   # English, French, and Kinyarwanda content
```

Keep components focused on presentation and interaction. Keep shared page state in `App.jsx`, reusable state in `context/`, and translated copy in `translations.js`.

## Quality checks

Run these before opening a pull request:

```bash
cd frontend
npm run format:check
npm run lint
npm run build
npm audit --omit=dev --audit-level=high
```

Use `npm run format` to format the frontend with the repository's Prettier configuration.

Create `backend/.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-server-key
SUPABASE_SERVICE_KEY=your-service-role-key
CORS_ORIGINS=http://localhost:5173,https://goslish.vercel.app
ENABLE_DEBUG_ENDPOINTS=false
```

For production, set `VITE_API_URL` in the frontend deployment to the public backend URL, for example `https://api.example.com`. Run the SQL in `supabase_schema.sql` before enabling the persistent visit counter.

## Deployment notes

- Keep `SUPABASE_SERVICE_KEY` server-side only.
- Use a specific `CORS_ORIGINS` list for the deployed frontend.
- Configure TLS, rate limiting at the hosting edge, and request logs at the backend host.
- The contact endpoint also applies payload validation and a per-process rate limit.

## Contact

claudeish88@gmail.com
