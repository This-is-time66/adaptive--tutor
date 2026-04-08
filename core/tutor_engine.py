import os
import json
from langchain_groq import ChatGroq
from core.models import Curriculum, Quiz

# ── LLM Initialization ───────────────────────────────────────
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

llm = ChatGroq(model_name="llama-3.3-70b-versatile", temperature=0.7)


# ── Agent: Planner ───────────────────────────────────────────
def run_planner(topic: str) -> list:
    """Generates a 5-step structured curriculum for a given topic."""
    structured_llm = llm.with_structured_output(Curriculum)
    prompt = f"Create a structured 5-step curriculum for: {topic}. Return a list of 5 goal titles."
    try:
        result = structured_llm.invoke(prompt)
        return result.goals
    except Exception:
        return ["Basics", "Core Concepts", "Intermediate", "Advanced", "Real-World Applications"]


# ── Agent: Teacher ───────────────────────────────────────────
def run_teacher(topic: str, goal: str) -> str:
    """Generates a lesson for a specific goal within a topic."""
    prompt = (
        f"You are a tutor. Teach the concept: '{goal}' in the context of '{topic}'. "
        f"Use clear definition, step-by-step bullet points."
    )
    response = llm.invoke(prompt)
    return response.content


# ── Agent: Quiz Generator ────────────────────────────────────
def run_quiz_generator(content: str) -> list:
    """Generates 3 multiple-choice quiz questions from lesson content."""
    structured_llm = llm.with_structured_output(Quiz)
    prompt = f"Based on this lesson: {content}, generate 3 multiple-choice questions. Ensure answer_index is 0-3."
    try:
        result = structured_llm.invoke(prompt)
        return [
            {
                "question": q.question,
                "options": q.options,
                "answerIndex": q.answer_index
            }
            for q in result.questions
        ]
    except Exception:
        return [{"question": "Error generating quiz.", "options": ["A", "B", "C", "D"], "answerIndex": 0}]


# ── Agent: Feedback Evaluator ────────────────────────────────
def run_feedback_evaluator(quiz_data: list, user_answers: list) -> tuple[str, int]:
    """Evaluates quiz answers and returns (feedback_text, score)."""
    results_detail = []
    score = 0

    for i, q in enumerate(quiz_data):
        user_choice = user_answers[i]
        is_correct = user_choice == q['answerIndex']
        if is_correct:
            score += 1
        results_detail.append({
            "question": q['question'],
            "status": "Correct" if is_correct else "Wrong",
            "correct_option": q['options'][q['answerIndex']]
        })

    prompt = (
        f"Evaluate student performance:\nScore: {score}/3\n"
        f"Details: {json.dumps(results_detail)}\n"
        f"Provide the marks, explain any wrong answers."
    )
    response = llm.invoke(prompt)
    return response.content, score