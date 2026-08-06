from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional


class Project(BaseModel):
    id: Optional[int] = None
    title: str
    description: str
    tech_stack: List[str]
    github_url: Optional[str] = None
    live_url: Optional[str] = None
    image_url: Optional[str] = None


class Skill(BaseModel):
    id: Optional[int] = None
    name: str = Field(min_length=2, max_length=100)
    category: str
    level: int  # 1-100


class ContactMessage(BaseModel):
    name: str
    email: EmailStr
    message: str = Field(min_length=10, max_length=5000)
    website: str = Field(default="", max_length=200)


class ContactResponse(BaseModel):
    success: bool
    message: str
