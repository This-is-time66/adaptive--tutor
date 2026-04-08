import os
from dotenv import load_dotenv
load_dotenv()

from typing import Optional
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from core.database import supabase, supabase_admin
from core.models import (
    SignupRequest, LoginRequest,
    PlanRequest, TeachRequest, QuizRequest, FeedbackRequest,
    SaveSessionRequest, ProgressRequest
)
from core.tutor_engine import (
    run_planner, run_teacher, run_quiz_generator, run_feedback_evaluator
)

# ── App Setup ────────────────────────────────────────────────
app = FastAPI(title="Adaptive Tutor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
def serve_frontend():
    return FileResponse("templates/index.html")


# ── Auth Helper ──────────────────────────────────────────────
def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.replace("Bearer ", "")
    try:
        user_resp = supabase.auth.get_user(token)
        if user_resp and user_resp.user:
            return user_resp.user
    except Exception:
        pass
    return None


# ── Auth Routes ──────────────────────────────────────────────
@app.post("/auth/signup")
def signup(req: SignupRequest):
    try:
        res = supabase.auth.sign_up({
            "email": req.email,
            "password": req.password,
            "options": {"data": {"full_name": req.full_name}}
        })
        if res.user:
            return {
                "message": "Signup successful! Please check your email to confirm your account.",
                "user_id": str(res.user.id),
                "email": res.user.email,
                "access_token": res.session.access_token if res.session else None
            }
        raise HTTPException(status_code=400, detail="Signup failed")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/auth/login")
def login(req: LoginRequest):
    try:
        res = supabase.auth.sign_in_with_password({
            "email": req.email,
            "password": req.password
        })
        if res.user and res.session:
            return {
                "message": "Login successful",
                "user_id": str(res.user.id),
                "email": res.user.email,
                "full_name": res.user.user_metadata.get("full_name", ""),
                "access_token": res.session.access_token,
                "refresh_token": res.session.refresh_token
            }
        raise HTTPException(status_code=401, detail="Invalid credentials")
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


@app.post("/auth/logout")
def logout(authorization: Optional[str] = Header(None)):
    try:
        supabase.auth.sign_out()
        return {"message": "Logged out successfully"}
    except Exception:
        return {"message": "Logged out"}


@app.delete("/auth/delete-account")
def delete_account(authorization: Optional[str] = Header(None)):
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    uid = str(user.id)
    try:
        supabase.table("lesson_history").delete().eq("user_id", uid).execute()
        supabase.table("sessions").delete().eq("user_id", uid).execute()
        supabase_admin.auth.admin.delete_user(uid)
        return {"message": "Account and all data permanently deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Session / History Routes ─────────────────────────────────
@app.post("/sessions/create")
def create_session(req: SaveSessionRequest, authorization: Optional[str] = Header(None)):
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        res = supabase.table("sessions").insert({
            "user_id": str(user.id),
            "topic": req.topic,
            "curriculum": req.curriculum,
            "current_step": 0,
            "current_phase": "lesson"
        }).execute()
        return {"session_id": res.data[0]["id"], "message": "Session created"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/sessions/{session_id}/progress")
def update_progress(session_id: str, req: ProgressRequest, authorization: Optional[str] = Header(None)):
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        supabase.table("sessions").update({
            "current_step": req.current_step,
            "current_phase": req.current_phase
        }).eq("id", session_id).eq("user_id", str(user.id)).execute()
        return {"message": "Progress saved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/history")
def get_history(authorization: Optional[str] = Header(None)):
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        sessions_res = supabase.table("sessions")\
            .select("*, lesson_history(*)")\
            .eq("user_id", str(user.id))\
            .order("created_at", desc=True)\
            .execute()
        return {"history": sessions_res.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/sessions/{session_id}")
def delete_session(session_id: str, authorization: Optional[str] = Header(None)):
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        supabase.table("sessions").delete()\
            .eq("id", session_id)\
            .eq("user_id", str(user.id))\
            .execute()
        return {"message": "Session deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Tutor Routes ─────────────────────────────────────────────
@app.post("/plan")
def plan(req: PlanRequest):
    goals = run_planner(req.topic)
    return {"curriculum": goals}


@app.post("/teach")
def teach(req: TeachRequest):
    content = run_teacher(req.topic, req.goal)
    return {"content": content}


@app.post("/quiz")
def quiz(req: QuizRequest):
    questions = run_quiz_generator(req.content)
    return {"quiz": questions}


@app.post("/feedback")
def feedback(req: FeedbackRequest, authorization: Optional[str] = Header(None)):
    feedback_text, score = run_feedback_evaluator(req.quiz_data, req.user_answers)

    # Persist to DB if user is authenticated
    user = get_current_user(authorization)
    if user and req.session_id and req.goal:
        try:
            supabase.table("lesson_history").insert({
                "session_id": req.session_id,
                "user_id": str(user.id),
                "goal": req.goal,
                "lesson_content": req.lesson_content or "",
                "quiz_score": score,
                "quiz_total": 3,
                "feedback": feedback_text
            }).execute()
        except Exception as e:
            print(f"DB save error: {e}")

    return {"feedback": feedback_text}


# ── Run ──────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=7860, reload=True)