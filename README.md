# Jean Claude ISHIMWE — Portfolio

Personal portfolio website showcasing my projects, skills, and certifications.

**Live site:** https://goslish.vercel.app

## Tech Stack

**Frontend**
- React 18 + Vite
- Tailwind CSS
- Axios

**Backend**
- FastAPI (Python)
- Supabase (PostgreSQL)

## Features

- Multilingual support (English, French, Kinyarwanda)
- Dark / light mode
- Live contact form
- Visit counter
- Photo gallery (images hosted on Supabase Storage)
- Downloadable CV
- Fully responsive

## Project Structure

```
portfolio/
├── frontend/   # React + Vite app
└── backend/    # FastAPI server
```

## Running Locally

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

**Backend**
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

Add a `.env` file in `backend/` with:
```
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
```

## Contact

claudeish88@gmail.com
