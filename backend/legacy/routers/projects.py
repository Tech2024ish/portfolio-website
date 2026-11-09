from fastapi import APIRouter, HTTPException
from database import get_client
from models.schemas import Project
from typing import List

router = APIRouter()


@router.get("/projects", response_model=List[Project])
def get_projects():
    with get_client() as client:
        response = client.get("/projects", params={"select": "*"})
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        return response.json()
