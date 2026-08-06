import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import projects, contact, visits, gallery

app = FastAPI(title="Portfolio API", version="1.0.0")

cors_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "https://goslish.vercel.app,http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)

app.include_router(projects.router, prefix="/api")
app.include_router(contact.router, prefix="/api")
app.include_router(visits.router, prefix="/api")
app.include_router(gallery.router, prefix="/api")


@app.get("/")
def read_root():
    return {"message": "Portfolio API is running"}
