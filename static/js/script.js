const API = window.location.origin;

function freshAppState() {
    return { topic:"", curriculum:[], currentStepIndex:0, currentPhase:"lesson", lessonContent:"", quizData:[], sessionId:null, completedLessons:[], totalScore:0 };
}
let appState = freshAppState();
let authState = { token: localStorage.getItem("tutor_token")||null, user: JSON.parse(localStorage.getItem("tutor_user")||"null") };

document.addEventListener("DOMContentLoaded", () => {
    if (authState.token && authState.user) updateNavLoggedIn(authState.user.full_name||authState.user.email);
    document.getElementById("topic-input").addEventListener("keydown", e => { if(e.key==="Enter") startApp(); });
    // Close account panel when clicking outside
    document.addEventListener("click", function(e) {
        const panel = document.getElementById("account-panel");
        const btn = document.getElementById("nav-account-btn");
        if (!panel.classList.contains("hidden") && !panel.contains(e.target) && !btn.contains(e.target)) {
            closeAccountPanel();
        }
    });
    showTab("home");
});

function showTab(tab) {
    ["home","workspace","history"].forEach(t => document.getElementById(`view-${t}`).classList.add("hidden"));
    document.getElementById(`view-${tab}`).classList.remove("hidden");
    closeAccountPanel();
    if (tab==="history") loadHistory();
}
function backToHome() { showTab("home"); }

function resetSession() {
    appState = freshAppState();
    document.getElementById("topic-input").value = "";
    document.getElementById("content-display").innerHTML = "";
    document.getElementById("content-footer").innerHTML = "";
    document.getElementById("content-title").textContent = "";
    document.getElementById("curriculum-list").innerHTML = "";
    document.getElementById("progress-card").style.display = "none";
    document.getElementById("progress-bar").style.width = "0%";
    document.getElementById("progress-text").textContent = "0 / 5 complete";
    document.getElementById("workspace-title").textContent = "";
    document.getElementById("workspace-badge").textContent = "";
    document.getElementById("agent-badge").textContent = "Ready";
    document.getElementById("conn-error").classList.add("hidden");
}
function startNewChat() { resetSession(); showTab("home"); }

// ── Save progress step+phase to DB ──────────────────────
async function saveProgress(step, phase) {
    if (!authState.token || !appState.sessionId) return;
    try {
        await fetch(`${API}/sessions/${appState.sessionId}/progress`, {
            method:"PATCH", headers: authHeaders(),
            body: JSON.stringify({ current_step: step, current_phase: phase })
        });
    } catch(e) {}
}

// ── ACCOUNT PANEL ────────────────────────────────────────
function toggleAccountPanel() {
    const panel = document.getElementById("account-panel");
    if (panel.classList.contains("hidden")) {
        openAccountPanel();
    } else {
        closeAccountPanel();
    }
}

function openAccountPanel() {
    const user = authState.user;
    if (!user) return;
    const name = user.full_name || user.email || "User";
    const email = user.email || "—";
    const initials = name.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);

    document.getElementById("account-avatar-initials").textContent = initials;
    document.getElementById("account-panel-name").textContent = name;
    document.getElementById("account-panel-name-field").textContent = name;
    document.getElementById("account-panel-email").textContent = email;
    document.getElementById("account-delete-error").classList.add("hidden");
    document.getElementById("account-chevron").textContent = "▲";
    document.getElementById("account-panel").classList.remove("hidden");
}

function closeAccountPanel() {
    document.getElementById("account-panel").classList.add("hidden");
    document.getElementById("account-chevron").textContent = "▼";
}

async function confirmDeleteAccount() {
    const confirmed = confirm(
        "⚠️ Are you sure you want to delete your account?\n\nThis will permanently delete:\n• Your account\n• All sessions\n• All learning history\n\nThis action cannot be undone."
    );
    if (!confirmed) return;

    const errEl = document.getElementById("account-delete-error");
    errEl.classList.add("hidden");

    try {
        const res = await fetch(`${API}/auth/delete-account`, {
            method: "DELETE",
            headers: authHeaders()
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Delete failed");

        // Wipe local state and log out
        resetSession();
        localStorage.removeItem("tutor_token");
        localStorage.removeItem("tutor_user");
        authState = { token: null, user: null };
        closeAccountPanel();
        updateNavLoggedOut();
        showTab("home");
        alert("✅ Your account and all data have been deleted.");
    } catch(err) {
        errEl.textContent = "❌ " + err.message;
        errEl.classList.remove("hidden");
    }
}
// ────────────────────────────────────────────────────────

function updateNavLoggedIn(name) {
    document.getElementById("nav-auth").classList.add("hidden");
    document.getElementById("nav-user").classList.remove("hidden");
    document.getElementById("nav-username").textContent = name;
}
function updateNavLoggedOut() {
    document.getElementById("nav-auth").classList.remove("hidden");
    document.getElementById("nav-user").classList.add("hidden");
}
function showAuthModal(tab) { document.getElementById("auth-modal").classList.remove("hidden"); switchAuthTab(tab); }
function closeAuthModal() { document.getElementById("auth-modal").classList.add("hidden"); }
function switchAuthTab(tab) { ["login","signup"].forEach(t => { document.getElementById(`tab-${t}`).classList.toggle("active",t===tab); document.getElementById(`form-${t}`).classList.toggle("hidden",t!==tab); }); }

async function doSignup() {
    const name=document.getElementById("signup-name").value.trim(), email=document.getElementById("signup-email").value.trim(), password=document.getElementById("signup-password").value;
    const errEl=document.getElementById("signup-error"), sucEl=document.getElementById("signup-success");
    errEl.classList.add("hidden"); sucEl.classList.add("hidden");
    if (!name||!email||!password){errEl.textContent="All fields are required.";errEl.classList.remove("hidden");return;}
    if (password.length<6){errEl.textContent="Password must be at least 6 characters.";errEl.classList.remove("hidden");return;}
    try {
        const res=await fetch(`${API}/auth/signup`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password,full_name:name})});
        const data=await res.json(); if(!res.ok) throw new Error(data.detail||"Signup failed");
        if(data.access_token){resetSession();saveAuth(data.access_token,{email,full_name:name});closeAuthModal();updateNavLoggedIn(name);showTab("home");}
        else{sucEl.textContent="✅ Account created! Please check your email to confirm, then login.";sucEl.classList.remove("hidden");}
    } catch(err){errEl.textContent=err.message;errEl.classList.remove("hidden");}
}

async function doLogin() {
    const email=document.getElementById("login-email").value.trim(), password=document.getElementById("login-password").value;
    const errEl=document.getElementById("login-error"); errEl.classList.add("hidden");
    if(!email||!password){errEl.textContent="Please enter email and password.";errEl.classList.remove("hidden");return;}
    try {
        const res=await fetch(`${API}/auth/login`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password})});
        const data=await res.json(); if(!res.ok) throw new Error(data.detail||"Login failed");
        resetSession();
        saveAuth(data.access_token,{email:data.email,full_name:data.full_name});
        closeAuthModal();updateNavLoggedIn(data.full_name||data.email);showTab("home");
    } catch(err){errEl.textContent="❌ "+err.message;errEl.classList.remove("hidden");}
}

async function logoutUser() {
    resetSession();
    localStorage.removeItem("tutor_token");localStorage.removeItem("tutor_user");
    authState={token:null,user:null};
    await fetch(`${API}/auth/logout`,{method:"POST"}).catch(()=>{});
    updateNavLoggedOut();closeAccountPanel();showTab("home");
}
function saveAuth(token,user){authState.token=token;authState.user=user;localStorage.setItem("tutor_token",token);localStorage.setItem("tutor_user",JSON.stringify(user));}
function authHeaders(){const h={"Content-Type":"application/json"};if(authState.token)h["Authorization"]=`Bearer ${authState.token}`;return h;}

// ── START NEW TOPIC ──────────────────────────────────────
async function startApp() {
    const topic=document.getElementById("topic-input").value.trim(); if(!topic) return;
    appState=freshAppState(); appState.topic=topic;
    document.getElementById("conn-error").classList.add("hidden");
    setWorkspaceTitle(topic); showLoading("🤖 Agent A: Planning your curriculum..."); showTab("workspace");
    try {
        const res=await fetch(`${API}/plan`,{method:"POST",headers:authHeaders(),body:JSON.stringify({topic})});
        const data=await res.json(); appState.curriculum=data.curriculum;
        if(authState.token){
            try{
                const sr=await fetch(`${API}/sessions/create`,{method:"POST",headers:authHeaders(),body:JSON.stringify({topic,curriculum:data.curriculum})});
                const sd=await sr.json(); appState.sessionId=sd.session_id;
            }catch(e){}
        }
        renderCurriculum(); document.getElementById("progress-card").style.display="block"; hideLoading(); loadLesson(0);
    } catch(err){document.getElementById("conn-error").classList.remove("hidden");showTab("home");}
}

function renderCurriculum() {
    const list=document.getElementById("curriculum-list");
    list.innerHTML=appState.curriculum.map((goal,i)=>{
        const isDone=appState.completedLessons.includes(i), isActive=i===appState.currentStepIndex;
        const cls=isDone?"done":isActive?"active":"", icon=isDone?"✓":isActive?"▶":(i+1);
        return `<div class="curr-item ${cls}">${icon}. ${goal}</div>`;
    }).join("");
    const done=appState.completedLessons.length, total=appState.curriculum.length;
    document.getElementById("progress-bar").style.width=`${(done/total)*100}%`;
    document.getElementById("progress-text").textContent=`${done} / ${total} complete`;
}

async function loadLesson(index) {
    appState.currentStepIndex=index; appState.currentPhase="lesson";
    renderCurriculum();
    setAgentBadge("Explainer","rgba(79,143,255,0.12)","#4f8fff","rgba(79,143,255,0.3)");
    document.getElementById("content-title").textContent=appState.curriculum[index];
    showLoading("🤖 Agent B: Explaining concept...");
    await saveProgress(index,"lesson");
    try {
        const res=await fetch(`${API}/teach`,{method:"POST",headers:authHeaders(),body:JSON.stringify({topic:appState.topic,goal:appState.curriculum[index]})});
        const data=await res.json(); appState.lessonContent=data.content;
        setContent(marked.parse(data.content));
        setFooter(`<button class="btn-primary" onclick="onClickTakeQuiz()">Take Quiz →</button>`);
        hideLoading();
    } catch(e){handleErr();}
}

async function onClickTakeQuiz() {
    appState.currentPhase="quiz";
    await saveProgress(appState.currentStepIndex,"quiz");
    loadQuiz();
}

async function loadQuiz() {
    setAgentBadge("Quizzer","rgba(245,158,11,0.12)","#f59e0b","rgba(245,158,11,0.3)");
    document.getElementById("content-title").textContent="Quiz Time";
    showLoading("🤖 Agent C: Generating quiz questions...");
    try {
        const res=await fetch(`${API}/quiz`,{method:"POST",headers:authHeaders(),body:JSON.stringify({content:appState.lessonContent})});
        const data=await res.json(); appState.quizData=data.quiz;
        let html=`<div class="space-y-8">`;
        appState.quizData.forEach((q,i)=>{
            html+=`<div><p style="font-weight:700;margin-bottom:12px;color:var(--text);">${i+1}. ${q.question}</p><div>`;
            q.options.forEach((opt,oi)=>{ html+=`<button class="quiz-option" id="opt-${i}-${oi}" onclick="selectOption(${i},${oi})">${opt}</button>`; });
            html+=`</div></div>`;
        });
        html+=`</div>`;
        setContent(html); setFooter(`<button class="btn-primary" onclick="submitQuiz()">Submit Quiz</button>`); hideLoading();
    } catch(e){handleErr();}
}

function selectOption(qIndex,optIndex) {
    appState.quizData[qIndex].options.forEach((_,oi)=>document.getElementById(`opt-${qIndex}-${oi}`)?.classList.remove("selected"));
    document.getElementById(`opt-${qIndex}-${optIndex}`)?.classList.add("selected");
    appState.quizData[qIndex]._selected=optIndex;
}

async function submitQuiz() {
    const finalAnswers=appState.quizData.map(q=>q._selected!==undefined?q._selected:-1);
    setAgentBadge("Feedback","rgba(34,197,94,0.12)","#22c55e","rgba(34,197,94,0.3)");
    document.getElementById("content-title").textContent="Evaluating...";
    showLoading("🤖 Agent D: Evaluating your answers...");
    try {
        const res=await fetch(`${API}/feedback`,{method:"POST",headers:authHeaders(),body:JSON.stringify({quiz_data:appState.quizData,user_answers:finalAnswers,session_id:appState.sessionId,goal:appState.curriculum[appState.currentStepIndex],lesson_content:appState.lessonContent})});
        const data=await res.json();
        if(!appState.completedLessons.includes(appState.currentStepIndex)) appState.completedLessons.push(appState.currentStepIndex);
        renderCurriculum();
        document.getElementById("content-title").textContent=appState.curriculum[appState.currentStepIndex];
        setContent(marked.parse(data.feedback));
        const isLast=appState.currentStepIndex===appState.curriculum.length-1;
        if(isLast){
            await saveProgress(appState.currentStepIndex,"done");
            setFooter(`
                <button onclick="startNewChat()" class="btn-secondary">＋ New Topic</button>
                 ${authState.token?`<button onclick="showAllLessonsReview()" class="btn-primary" style="background:var(--accent2);">📖 Read All Lessons</button>`:''}
                ${authState.token?`<button onclick="showTab('history')" class="btn-primary">📋 History</button>`:''}
            `);
        } else {
            const next=appState.currentStepIndex+1;
            await saveProgress(next,"lesson");
            setFooter(`<button class="btn-primary" onclick="loadLesson(${next})">Next Lesson →</button>`);
        }
        hideLoading();
    } catch(e){handleErr();}
}

async function showAllLessonsReview() {
    setAgentBadge("Summary","rgba(124,92,255,0.15)","#7c5cff","rgba(124,92,255,0.4)");
    document.getElementById("content-title").textContent="Full Course Review";
    setFooter(""); showLoading("Loading your full course...");
    let lessons=[];
    if(authState.token&&appState.sessionId){
        try{
            const res=await fetch(`${API}/history`,{headers:authHeaders()});
            const data=await res.json();
            const session=(data.history||[]).find(s=>s.id===appState.sessionId);
            if(session&&session.lesson_history) lessons=session.lesson_history;
        }catch(e){}
    }
    hideLoading();
    if(lessons.length===0){
        setContent(`<div class="alert-error">Could not load lesson details.</div>`);
        setFooter(`<button onclick="startNewChat()" class="btn-secondary">＋ New Topic</button>`);
        return;
    }
    setContent(buildReviewHTML(appState.topic, lessons));
    setFooter(`
        <button onclick="startNewChat()" class="btn-secondary">＋ New Topic</button>
        ${authState.token?`<button onclick="showTab('history')" class="btn-primary">📋 My History</button>`:''}
    `);
}

function buildReviewHTML(topic, lessons) {
    const avg=(lessons.reduce((s,l)=>s+(l.quiz_score||0),0)/lessons.length).toFixed(1);
    let html=`
        <div style="margin-bottom:24px;padding:14px 18px;background:rgba(124,92,255,0.1);border:1px solid rgba(124,92,255,0.3);border-radius:12px;">
            <h2 class="font-display" style="font-size:1.1rem;font-weight:800;color:#a78bfa;margin-bottom:4px;">🎓 Course Complete — ${topic}</h2>
            <p style="color:var(--muted);font-size:0.88rem;">${lessons.length} lessons · Avg score ${avg}/${lessons[0]?.quiz_total||3} · Scroll to review everything</p>
        </div>`;
    lessons.forEach((lesson,idx)=>{
        const sc=lesson.quiz_score>=2?"var(--success)":lesson.quiz_score===1?"var(--warning)":"var(--danger)";
        html+=`
        <div class="lesson-review-block">
            <div class="lesson-review-header">
                <div style="display:flex;align-items:center;gap:10px;">
                    <span style="background:var(--accent);color:#fff;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.78rem;font-weight:800;font-family:'Syne',sans-serif;flex-shrink:0;">${idx+1}</span>
                    <span class="font-display" style="font-weight:700;font-size:1rem;">${lesson.goal}</span>
                </div>
                <span class="badge" style="background:rgba(34,197,94,0.1);color:${sc};border:1px solid ${sc}44;">Quiz ${lesson.quiz_score}/${lesson.quiz_total}</span>
            </div>
            <div class="lesson-review-body">
                <p style="font-size:0.75rem;font-weight:700;letter-spacing:0.08em;color:var(--muted);margin-bottom:10px;">LESSON CONTENT</p>
                <div class="md" style="margin-bottom:18px;">${marked.parse(lesson.lesson_content||'')}</div>
                <div style="border-top:1px solid var(--border);padding-top:16px;">
                    <p style="font-size:0.75rem;font-weight:700;letter-spacing:0.08em;color:var(--muted);margin-bottom:10px;">FEEDBACK & SCORE</p>
                    <div class="md">${marked.parse(lesson.feedback||'')}</div>
                </div>
            </div>
        </div>`;
    });
    html+=`
        <div style="text-align:center;padding:24px;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);border-radius:14px;margin-top:8px;">
            <p style="font-size:2rem;margin-bottom:8px;">🏆</p>
            <h3 class="font-display" style="font-size:1.1rem;font-weight:800;color:var(--success);margin-bottom:6px;">Course Completed!</h3>
            <p style="color:var(--muted);font-size:0.88rem;">Average score: ${avg} / ${lessons[0]?.quiz_total||3}</p>
        </div>`;
    return html;
}

let _sessionCache = {};

async function loadHistory() {
    if(!authState.token){
        document.getElementById("history-content").innerHTML=`
            <div style="text-align:center;padding:80px 20px;">
                <p style="font-size:2.5rem;margin-bottom:16px;">🔒</p>
                <h3 class="font-display" style="font-size:1.2rem;font-weight:700;margin-bottom:8px;">Login Required</h3>
                <p style="color:var(--muted);margin-bottom:20px;">Login to view and save your learning history.</p>
                <button class="btn-primary" onclick="showAuthModal('login')">Login</button>
            </div>`;
        return;
    }
    document.getElementById("history-loading").classList.remove("hidden");
    document.getElementById("history-content").innerHTML="";
    document.getElementById("history-empty").classList.add("hidden");
    try {
        const res=await fetch(`${API}/history`,{headers:authHeaders()});
        const data=await res.json();
        document.getElementById("history-loading").classList.add("hidden");
        if(!data.history||data.history.length===0){document.getElementById("history-empty").classList.remove("hidden");return;}

        _sessionCache = {};
        data.history.forEach(s => { _sessionCache[s.id] = s; });

        document.getElementById("history-content").innerHTML=data.history.map(session=>{
            const date=new Date(session.created_at).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"});
            const lessons=session.lesson_history||[], totalLessons=(session.curriculum||[]).length||5;
            const isComplete=lessons.length>=totalLessons;
            const avgScore=lessons.length>0?(lessons.reduce((s,l)=>s+(l.quiz_score||0),0)/lessons.length).toFixed(1):null;
            const progressPct=Math.round((lessons.length/totalLessons)*100);
            const sid=session.id;
            return `
            <div class="history-card">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
                    <div style="flex:1;cursor:pointer;" onclick="restoreSession('${sid}')">
                        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                            <h3 class="font-display history-topic-link" style="font-size:1.1rem;font-weight:700;">${session.topic}</h3>
                            ${isComplete?`<span class="badge" style="background:rgba(34,197,94,0.12);color:var(--success);border:1px solid rgba(34,197,94,0.3);">✓ Complete</span>`:`<span class="badge" style="background:rgba(245,158,11,0.12);color:var(--warning);border:1px solid rgba(245,158,11,0.3);">In Progress</span>`}
                            ${avgScore!==null?`<span class="badge" style="background:rgba(79,143,255,0.1);color:var(--accent);border:1px solid rgba(79,143,255,0.3);">Avg ${avgScore}/3</span>`:''}
                            <span style="color:var(--muted);font-size:0.8rem;">📅 ${date}</span>
                        </div>
                        <div style="margin-top:10px;background:var(--border);border-radius:999px;height:4px;width:180px;overflow:hidden;">
                            <div style="height:100%;width:${progressPct}%;background:${isComplete?'var(--success)':'var(--accent)'};border-radius:999px;"></div>
                        </div>
                        <p style="color:var(--muted);font-size:0.8rem;margin-top:5px;">${lessons.length} / ${totalLessons} lessons · <span style="color:var(--accent);font-weight:600;">▶ Click to ${isComplete?'review':'resume'}</span></p>
                        ${lessons.length>0?`
                        <div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:8px;">
                            ${lessons.map(l=>`<div style="background:var(--surface);border:1px solid var(--border);padding:5px 10px;border-radius:8px;font-size:0.78rem;"><span style="color:var(--text);">${l.goal}</span><span style="color:var(--accent);margin-left:6px;font-weight:700;">${l.quiz_score}/${l.quiz_total}</span></div>`).join('')}
                        </div>`:''}
                    </div>
                    <button class="btn-danger" onclick="event.stopPropagation();deleteSession('${sid}')">Delete</button>
                </div>
            </div>`;
        }).join("");
    } catch(err){
        document.getElementById("history-loading").classList.add("hidden");
        document.getElementById("history-content").innerHTML=`<div class="alert-error">Failed to load history.</div>`;
    }
}

async function restoreSession(sessionId) {
    const session = _sessionCache[sessionId];
    if (!session) { alert("Session not found. Please refresh the history page."); return; }
    const lessons=session.lesson_history||[], curriculum=session.curriculum||[];
    const totalLessons=curriculum.length||5;
    const isComplete=lessons.length>=totalLessons;
    const savedStep=session.current_step??lessons.length;
    const savedPhase=session.current_phase??"lesson";

    appState=freshAppState();
    appState.topic=session.topic; appState.curriculum=curriculum; appState.sessionId=session.id;
    lessons.forEach((_,i)=>{if(!appState.completedLessons.includes(i)) appState.completedLessons.push(i);});

    document.getElementById("topic-input").value=session.topic;
    setWorkspaceTitle(session.topic);
    document.getElementById("workspace-badge").textContent=isComplete?"Complete":"Resumed";
    document.getElementById("progress-card").style.display="block";
    renderCurriculum(); showTab("workspace");

    if(isComplete&&savedPhase==="done"){
        setAgentBadge("Summary","rgba(124,92,255,0.15)","#7c5cff","rgba(124,92,255,0.4)");
        document.getElementById("content-title").textContent="Full Course Review";
        setContent(buildReviewHTML(session.topic, lessons));
        setFooter(`<button onclick="startNewChat()" class="btn-secondary">＋ New Topic</button><button onclick="showTab('history')" class="btn-primary">📋 My History</button>`);
        return;
    }

    if(savedPhase==="quiz"){
        appState.currentStepIndex=savedStep;
        setAgentBadge("Quizzer","rgba(245,158,11,0.12)","#f59e0b","rgba(245,158,11,0.3)");
        document.getElementById("content-title").textContent=curriculum[savedStep]||"Quiz";
        showLoading("🤖 Restoring your quiz...");
        try {
            const r=await fetch(`${API}/teach`,{method:"POST",headers:authHeaders(),body:JSON.stringify({topic:session.topic,goal:curriculum[savedStep]})});
            const d=await r.json(); appState.lessonContent=d.content;
            hideLoading(); loadQuiz();
        } catch(e){ hideLoading(); loadLesson(savedStep); }
    } else {
        appState.currentStepIndex=savedStep;
        loadLesson(savedStep);
    }
}

async function deleteSession(sessionId) {
    if(!confirm("Delete this session?")) return;
    try{ await fetch(`${API}/sessions/${sessionId}`,{method:"DELETE",headers:authHeaders()}); loadHistory(); }
    catch(e){alert("Failed to delete.");}
}

function setWorkspaceTitle(topic){document.getElementById("workspace-title").textContent=topic;document.getElementById("workspace-badge").textContent="In Progress";}
function setAgentBadge(name,bg,color,border){const b=document.getElementById("agent-badge");b.textContent=name;b.style.background=bg;b.style.color=color;b.style.borderColor=border;}
function showLoading(msg){document.getElementById("loading-msg").textContent=msg;document.getElementById("content-loading").style.display="flex";document.getElementById("content-display").style.display="none";document.getElementById("content-footer").innerHTML="";}
function hideLoading(){document.getElementById("content-loading").style.display="none";document.getElementById("content-display").style.display="block";}
function setContent(html){document.getElementById("content-display").innerHTML=html;}
function setFooter(html){document.getElementById("content-footer").innerHTML=html;}
function handleErr(){hideLoading();setContent(`<div class="alert-error">⚠️ Error communicating with the Python agents. Make sure <strong>main.py</strong> is running on port 8000.</div>`);}

document.getElementById("auth-modal").addEventListener("click",function(e){if(e.target===this)closeAuthModal();});