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
