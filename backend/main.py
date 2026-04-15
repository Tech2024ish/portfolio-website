from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import projects, skills, contact, visits

app = FastAPI(title="Portfolio API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router, prefix="/api")
app.include_router(skills.router, prefix="/api")
app.include_router(contact.router, prefix="/api")
app.include_router(visits.router, prefix="/api")


@app.get("/")
def read_root():
    return {"message": "Portfolio API is running"}
