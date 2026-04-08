# 🎓 Adaptive Tutor — AI-Powered Learning System

A multi-agent AI tutoring system built with FastAPI, LangChain (Groq), and Supabase.

---

## 📁 Final Project Structure

```
adaptive-tutor/
├── app.py                  # FastAPI entry point — all routes & middleware
├── core/
│   ├── database.py         # Supabase client initialization
│   ├── models.py           # Pydantic request/response schemas
│   └── tutor_engine.py     # LLM logic — Planner, Teacher, Quiz, Feedback agents
├── templates/
│   └── index.html          # Frontend HTML
├── static/
│   ├── css/
│   │   └── style.css       # Frontend styles
│   └── js/
│       └── script.js       # Frontend JavaScript
├── .env                    # Local secrets (never commit this)
├── .dockerignore
├── .gitignore
├── Dockerfile              # For Hugging Face / Docker deployment
└── requirements.txt        # Python dependencies
└── README.md
```

---

## 🖥️ Run Locally in VS Code

### Step 1 — Clone / open the project
Open the `adaptive-tutor/` folder in VS Code.

### Step 2 — Create a virtual environment
```bash
python -m venv venv
```

Activate it:
- **Windows:** `venv\Scripts\activate`
- **Mac/Linux:** `source venv/bin/activate`

### Step 3 — Install dependencies
```bash
pip install -r requirements.txt
```

### Step 4 — Create your `.env` file
 fill in  your real keys:
```
GROQ_API_KEY=your_groq_api_key_here
SUPABASE_URL=your_supabase_project_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_KEY=your_supabase_service_role_key_here
```


### Step 5 — Database Setup

```sql
-- ============================================================
-- Run this entire in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. USER PROFILES TABLE

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
    full_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. SESSIONS TABLE
-- Each time a user starts learning a topic = one session
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    topic TEXT NOT NULL,
    curriculum JSONB NOT NULL DEFAULT '[]',
    current_step INTEGER DEFAULT 0,            
    current_phase TEXT DEFAULT 'lesson',        
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. LESSON HISTORY TABLE
-- Stores each lesson + quiz result per session
CREATE TABLE IF NOT EXISTS public.lesson_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    goal TEXT NOT NULL,
    lesson_content TEXT,
    quiz_score INTEGER,
    quiz_total INTEGER,
    feedback TEXT,
    completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) - IMPORTANT FOR SECURITY
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_history ENABLE ROW LEVEL SECURITY;

-- Profiles: users can only see/edit their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Sessions: users can only see/create their own sessions
CREATE POLICY "Users can view own sessions" ON public.sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sessions" ON public.sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions" ON public.sessions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions" ON public.sessions
    FOR DELETE USING (auth.uid() = user_id);

-- Lesson history: users can only see/create their own history
CREATE POLICY "Users can view own lesson history" ON public.lesson_history
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own lesson history" ON public.lesson_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP (Trigger)
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


```


### Step 6 — Run the server
```bash
python app.py
```


---

## 🚀 Deploy on Hugging Face Spaces (Free, Docker)

### Step 1 — Create a new Space
1. Go to [huggingface.co/spaces](https://huggingface.co/spaces)
2. Click **Create new Space**
3. Fill in:
   - **Space name:** `adaptive-tutor` (or your choice)
   - **SDK:** Select **Docker**
   - **Visibility:** Public or Private
4. Click **Create Space**

### Step 2 — Add Secret Environment Variables
> ⚠️ Never upload your `.env` file. Use Hugging Face Secrets instead.

1. In your Space, go to **Settings → Variables and Secrets**
2. Add each secret one by one:
   - `GROQ_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_KEY`

### Step 3 — Push your code
Initialize git and push (make sure `.env` is in `.gitignore`):

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://huggingface.co/spaces/YOUR_USERNAME/adaptive-tutor
git push origin main
```

> If asked for credentials, use your Hugging Face username and an **Access Token** (from HF Settings → Access Tokens).

### Step 4 — Wait for build
Hugging Face will automatically:
1. Detect your `Dockerfile`
2. Build the Docker image
3. Start the app on port 7860

Your app will be live at:
```
https://YOUR_USERNAME-adaptive-tutor.hf.space
```

---

## 🔑 Getting Your API Keys

| Key | Where to get it |
|-----|----------------|
| `GROQ_API_KEY` | [console.groq.com](https://console.groq.com) → API Keys |
| `SUPABASE_URL` | Supabase Dashboard → Project Settings → API |
| `SUPABASE_ANON_KEY` | Supabase Dashboard → Project Settings → API |
| `SUPABASE_SERVICE_KEY` | Supabase Dashboard → Project Settings → API → service_role |

---

## ⚠️ Common Issues

| Problem | Fix |
|---------|-----|
| `ModuleNotFoundError: core` | Make sure you run `python app.py` from inside the `adaptive-tutor/` folder |
| `supabase client error` | Check your `.env` keys are correct and not empty |
| HF Space stuck on "Building" | Check the build logs in the Space for pip install errors |
| Port error locally | Change `7860` to `8000` in `app.py` if needed |