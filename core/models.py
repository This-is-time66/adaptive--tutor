from typing import List, Dict, Optional
from pydantic import BaseModel, Field


# ── LLM Structured Output Schemas ───────────────────────────

class Curriculum(BaseModel):
    goals: List[str] = Field(description="Exactly 5 sequential learning goals for the topic")


class QuizQuestion(BaseModel):
    question: str
    options: List[str]
    answer_index: int


class Quiz(BaseModel):
    questions: List[QuizQuestion]


# ── Auth Request Schemas ─────────────────────────────────────

class SignupRequest(BaseModel):
    email: str
    password: str
    full_name: str


class LoginRequest(BaseModel):
    email: str
    password: str


# ── Tutor Request Schemas ────────────────────────────────────

class PlanRequest(BaseModel):
    topic: str
    session_id: Optional[str] = None


class TeachRequest(BaseModel):
    topic: str
    goal: str
    session_id: Optional[str] = None


class QuizRequest(BaseModel):
    content: str


class FeedbackRequest(BaseModel):
    quiz_data: List[Dict]
    user_answers: List[int]
    session_id: Optional[str] = None
    goal: Optional[str] = None
    lesson_content: Optional[str] = None


# ── Session / Progress Schemas ───────────────────────────────

class SaveSessionRequest(BaseModel):
    topic: str
    curriculum: List[str]


class ProgressRequest(BaseModel):
    current_step: int
    current_phase: str