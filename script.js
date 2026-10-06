/* =========================================================
   Smart Classroom & AI Timetable Scheduler — script.js
   Vanilla JS + Supabase backend (PostgreSQL).
   localStorage used ONLY for theme + display session cache.
   ========================================================= */

/* ---------------- Supabase Init ---------------- */

const SUPABASE_URL = "https://vbhrbdnhpzvzrrjfwjub.supabase.co";
const SUPABASE_KEY = "sb_publishable_A267AUsJwboPuzPC8I86fw_dBvIWbaB";

let _sb = null;
function sb(){
  if(!_sb){
    if(typeof supabase === "undefined" || !supabase.createClient){
      console.error("Supabase JS library not loaded.");
      return null;
    }
    _sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }
  return _sb;
}

/* ---------------- Constants ---------------- */

const DAYS  = ["Monday","Tuesday","Wednesday","Thursday","Friday"];
const SLOTS = ["09:00 - 10:00","10:00 - 11:00","11:15 - 12:15","01:00 - 02:00","02:00 - 03:00"];
const SUBJECT_POOL = [
  "Machine Learning","Python Programming","Java","Database Systems",
  "Operating Systems","Cloud Computing","Cyber Security","Software Engineering",
  "AI Lab","Data Structures","Computer Networks","Web Development"
];

const KEYS = {
  theme:   "sca_theme",
  username:"username",
  rollno:  "rollno",
  role:    "role",
  email:   "sca_email"
};

/* ---------------- Small utils ---------------- */

const $  = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));

function uid(){ return Math.random().toString(36).slice(2,9); }

function todayName(){
  const d = new Date().getDay();
  const map = {1:"Monday",2:"Tuesday",3:"Wednesday",4:"Thursday",5:"Friday"};
  return map[d] || "Monday";
}

/* ---------------- Toasts ---------------- */

function toast(message, type="info"){
  let stack = $("#toast-stack");
  if(!stack){
    stack = document.createElement("div");
    stack.id = "toast-stack";
    document.body.appendChild(stack);
  }
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  const icon = type==="success" ? "✅" : type==="error" ? "⚠️" : "ℹ️";
  el.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  stack.appendChild(el);
  setTimeout(()=>{
    el.style.transition = "opacity .3s, transform .3s";
    el.style.opacity = "0";
    el.style.transform = "translateY(8px)";
    setTimeout(()=> el.remove(), 300);
  }, 3200);
}

/* ---------------- Theme ---------------- */

function initTheme(){
  const saved = localStorage.getItem(KEYS.theme) || "light";
  document.documentElement.setAttribute("data-theme", saved);
  const btn = $("#themeToggle");
  if(btn) btn.textContent = saved === "dark" ? "☀️" : "🌙";
}

function toggleTheme(){
  const cur = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  const next = cur === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem(KEYS.theme, next);
  const btn = $("#themeToggle");
  if(btn) btn.textContent = next === "dark" ? "☀️" : "🌙";
}

/* ---------------- Auth session (localStorage display cache) ---------------- */

function getCurrentUser(){
  const name = localStorage.getItem(KEYS.username);
  const role = localStorage.getItem(KEYS.role);
  if(!name || !role) return null;
  return {
    name,
    role,
    email:  localStorage.getItem(KEYS.email)  || "",
    rollno: localStorage.getItem(KEYS.rollno) || ""
  };
}

function setCurrentUser(name, role, email, rollno=""){
  localStorage.setItem(KEYS.username, name);
  localStorage.setItem(KEYS.role, role);
  localStorage.setItem(KEYS.email, email || "");
  localStorage.setItem(KEYS.rollno, rollno);
}

function clearCurrentUser(){
  [KEYS.username, KEYS.role, KEYS.email, KEYS.rollno].forEach(k => localStorage.removeItem(k));
}

function capitalize(str){
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
}

function renderUserChip(){
  const chip = $("#userChip");
  const user = getCurrentUser();
  if(!chip) return;
  if(user){
    chip.style.display = "flex";
    const rollBit = user.role === "student" && user.rollno ? ` · ${user.rollno}` : "";
    chip.innerHTML = `<span class="dot">${user.name.charAt(0)}</span> ${user.name} · <span class="muted" style="margin-left:2px;">${capitalize(user.role)}${rollBit}</span>`;
  } else {
    chip.style.display = "none";
  }
}

/* ---------------- requireAuth (uses Supabase session + local cache) ---------------- */

async function requireAuth(allowedRoles){
  const client = sb();
  if(client){
    const { data:{ session } } = await client.auth.getSession();
    if(!session){
      clearCurrentUser();
      window.location.href = "login.html";
      return null;
    }
    const meta = session.user.user_metadata || {};
    const role = meta.role || localStorage.getItem(KEYS.role);
    if(!allowedRoles.includes(role)){
      window.location.href = "login.html";
      return null;
    }
    // Refresh local display cache from Supabase session
    const name = meta.full_name || localStorage.getItem(KEYS.username) || session.user.email;
    setCurrentUser(name, role, session.user.email, meta.rollno || "");
    return getCurrentUser();
  }
  // Fallback: Supabase not available — use local cache
  const user = getCurrentUser();
  if(!user || !allowedRoles.includes(user.role)){
    window.location.href = "login.html";
    return null;
  }
  return user;
}

/* ---------------- Logout ---------------- */

async function logout(){
  const client = sb();
  if(client){
    await client.auth.signOut().catch(()=>{});
  }
  clearCurrentUser();
  window.location.href = "login.html";
}

/* ---------------- Login form validation + Supabase sign-in ---------------- */

function markField(fieldEl, invalid, message){
  if(!fieldEl) return;
  const errEl = fieldEl.querySelector(".error");
  fieldEl.classList.toggle("invalid", invalid);
  if(errEl && message) errEl.textContent = message;
}

function handleRoleChange(){
  const roleEl = $("#role");
  if(!roleEl) return;
  const role = roleEl.value;
  const rollnoField = $("#rollnoField");
  if(rollnoField) rollnoField.style.display = role === "student" ? "block" : "none";
  if(role !== "student" && rollnoField){
    const rollnoFieldEl = $("#rollnoField");
    if(rollnoFieldEl) markField(rollnoFieldEl, false);
    const rollnoInput = $("#rollno");
    if(rollnoInput) rollnoInput.value = "";
  }
  $$(".role-pick button").forEach(b => b.classList.toggle("active", b.dataset.role === role));
}

function selectRole(role){
  const roleEl = $("#role");
  if(roleEl) roleEl.value = role;
  handleRoleChange();
  const roleField = $("#roleField");
  if(roleField) markField(roleField, false);
}

async function validateLogin(){
  const roleField   = $("#roleField");
  const nameField   = $("#nameField");
  const rollnoField = $("#rollnoField");
  const passField   = $("#passField");

  const role     = ($("#role") || {value:""}).value;
  const name     = (($("#name") || {value:""}).value).trim();
  const rollno   = (($("#rollno") || {value:""}).value).trim();
  const password = (($("#password") || {value:""}).value);

  // If the page uses email-based login (Supabase style) use #email instead of #name
  const emailInput = $("#email");
  const email      = emailInput ? emailInput.value.trim() : "";

  const namePattern = /^[A-Za-z ]+$/;
  let ok = true;

  if(roleField){
    if(role === ""){
      markField(roleField, true, "Please select a user type.");
      ok = false;
    } else markField(roleField, false);
  }

  // If using email login, validate email; else validate name
  if(emailInput){
    const emailPattern = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if(!emailPattern.test(email)){
      if(nameField) markField(nameField, true, "Enter a valid email address.");
      ok = false;
    } else if(nameField) markField(nameField, false);
  } else if(nameField){
    if(!namePattern.test(name) || name.length < 2){
      markField(nameField, true, "Name should contain only alphabets and be at least 2 characters.");
      ok = false;
    } else markField(nameField, false);
  }

  if(role === "student" && rollnoField){
    if(rollno === ""){
      markField(rollnoField, true, "Roll number cannot be empty.");
      ok = false;
    } else markField(rollnoField, false);
  }

  if(passField){
    if(password.length < 6){
      markField(passField, true, "Password must be at least 6 characters.");
      ok = false;
    } else markField(passField, false);
  }

  if(!ok){
    toast("Please fix the highlighted fields.", "error");
    return false;
  }

  // --- Supabase login ---
  const client = sb();
  if(client && email){
    toast("Signing in…", "info");
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if(error){
      toast("Login failed: " + error.message, "error");
      return false;
    }
    const meta      = data.user.user_metadata || {};
    const userRole  = meta.role || role || "student";
    const userName  = meta.full_name || name || email;
    const userRoll  = meta.rollno   || rollno || "";
    setCurrentUser(userName, userRole, email, userRoll);
    toast(`Welcome, ${userName}!`, "success");
    setTimeout(()=>{
      if(userRole === "admin")   window.location.href = "admin.html";
      else if(userRole === "teacher") window.location.href = "teacher.html";
      else                            window.location.href = "student.html";
    }, 500);
    return false;
  }

  // --- Fallback: name-only localStorage login (original behaviour) ---
  setCurrentUser(name, role, "", rollno);

  // Keep teacher/student directories in sync
  if(role === "teacher"){
    const teachers = await fetchTeachers();
    const exists   = teachers.find(t => t.name === name);
    if(!exists) await dbInsertTeacher({ name, subject:"—" });
  }
  if(role === "student"){
    const students = await fetchStudents();
    const exists   = students.find(s => s.name === name);
    if(!exists) await dbInsertStudent({ name, roll_no:rollno, dept:"—", sem:"1", div:"A" });
  }

  toast(`Welcome, ${name}!`, "success");
  setTimeout(()=>{
    if(role === "admin")   window.location.href = "admin.html";
    else if(role === "teacher") window.location.href = "teacher.html";
    else                        window.location.href = "student.html";
  }, 500);
  return false;
}

/* ---------------- Registration form + Supabase sign-up ---------------- */

function regHandleRoleChange(){
  const regRoleEl = $("#regRole");
  if(!regRoleEl) return;
  const role = regRoleEl.value;
  const rollnoField = $("#regRollnoField");
  if(rollnoField) rollnoField.style.display = role === "student" ? "block" : "none";
  if(role !== "student" && rollnoField){
    markField(rollnoField, false);
    const ri = $("#regRollno"); if(ri) ri.value = "";
  }
  $$(".role-pick button").forEach(b => b.classList.toggle("active", b.dataset.role === role));
}

function regSelectRole(role){
  const el = $("#regRole"); if(el) el.value = role;
  regHandleRoleChange();
  const rf = $("#regRoleField"); if(rf) markField(rf, false);
}

async function validateRegistration(){
  const roleField    = $("#regRoleField");
  const fnameField   = $("#fnameField");
  const lnameField   = $("#lnameField");
  const rollnoField  = $("#regRollnoField");
  const passField    = $("#regPassField");
  const emailField   = $("#regEmailField");
  const mobileField  = $("#mobileField");
  const addressField = $("#addressField");

  const role     = ($("#regRole")     ||{value:""}).value;
  const fname    = (($("#fname")      ||{value:""}).value).trim();
  const lname    = (($("#lname")      ||{value:""}).value).trim();
  const rollno   = (($("#regRollno")  ||{value:""}).value).trim();
  const password = (($("#regPassword")||{value:""}).value);
  const email    = (($("#regEmail")   ||{value:""}).value).trim();
  const mobile   = (($("#mobile")     ||{value:""}).value).trim();
  const address  = (($("#address")    ||{value:""}).value).trim();

  const namePattern  = /^[A-Za-z]+$/;
  const emailPattern = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  const mobilePattern= /^[0-9]{10}$/;
  let ok = true;

  if(roleField){
    if(role === ""){ markField(roleField, true); ok = false; }
    else markField(roleField, false);
  }
  if(fnameField){
    if(!namePattern.test(fname) || fname.length < 2){ markField(fnameField, true); ok = false; }
    else markField(fnameField, false);
  }
  if(lnameField){
    if(lname === ""){ markField(lnameField, true); ok = false; }
    else markField(lnameField, false);
  }
  if(role === "student" && rollnoField){
    if(rollno === ""){ markField(rollnoField, true); ok = false; }
    else markField(rollnoField, false);
  }
  if(passField){
    if(password.length < 6){ markField(passField, true); ok = false; }
    else markField(passField, false);
  }
  if(emailField){
    if(!emailPattern.test(email)){ markField(emailField, true); ok = false; }
    else markField(emailField, false);
  }
  if(mobileField){
    if(!mobilePattern.test(mobile)){ markField(mobileField, true); ok = false; }
    else markField(mobileField, false);
  }
  if(addressField){
    if(address === ""){ markField(addressField, true); ok = false; }
    else markField(addressField, false);
  }

  if(!ok){
    toast("Please fix the highlighted fields.", "error");
    return false;
  }

  const fullName = `${fname} ${lname}`;
  const client   = sb();

  if(client){
    toast("Creating your account…", "info");
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options:{
        data:{
          full_name: fullName,
          role,
          rollno:  role === "student" ? rollno : "",
          mobile,
          address
        }
      }
    });

    if(error){
      toast("Registration failed: " + error.message, "error");
      return false;
    }

    // Insert into the right Supabase table
    if(role === "teacher"){
      const existing = await fetchTeachers();
      if(!existing.find(t => t.name === fullName)){
        await dbInsertTeacher({ name:fullName, subject:"—", email });
      }
    }
    if(role === "student"){
      const existing = await fetchStudents();
      if(!existing.find(s => s.roll_no === rollno)){
        await dbInsertStudent({ name:fullName, roll_no:rollno, dept:"—", sem:"1", div:"A" });
      }
    }

    setCurrentUser(fullName, role, email, role === "student" ? rollno : "");
    toast("🎉 Registration Successful!", "success");
    const formEl = $("#registrationForm"); if(formEl) formEl.reset();
    setTimeout(()=>{
      if(role === "admin")   window.location.href = "admin.html";
      else if(role === "teacher") window.location.href = "teacher.html";
      else                        window.location.href = "student.html";
    }, 700);
    return false;
  }

  // Fallback: no Supabase — pure localStorage
  setCurrentUser(fullName, role, email, role === "student" ? rollno : "");
  if(role === "teacher") await dbInsertTeacher({ name:fullName, subject:"—" });
  if(role === "student") await dbInsertStudent({ name:fullName, roll_no:rollno, dept:"—", sem:"1", div:"A" });

  toast("🎉 Registration Successful!", "success");
  const formEl = $("#registrationForm"); if(formEl) formEl.reset();
  setTimeout(()=>{
    if(role === "admin")   window.location.href = "admin.html";
    else if(role === "teacher") window.location.href = "teacher.html";
    else                        window.location.href = "student.html";
  }, 700);
  return false;
}

/* ================================================================
   SUPABASE DATABASE HELPERS
   All CRUD goes through these. Each returns an array or object.
   On error: shows toast and returns empty array / null.
   ================================================================ */

/* ---------- Students ---------- */

async function fetchStudents(){
  const client = sb(); if(!client) return [];
  const { data, error } = await client.from("students").select("*").order("created_at", {ascending:true});
  if(error){ console.error("fetchStudents:", error); return []; }
  return data || [];
}

async function dbInsertStudent(s){
  const client = sb(); if(!client) return null;
  const { data, error } = await client.from("students").insert([{
    name:   s.name,
    roll_no:s.roll_no || s.roll || "",
    dept:   s.dept   || "—",
    sem:    String(s.sem || "1"),
    div:    s.div    || "A"
  }]).select().single();
  if(error){ toast("DB error (student insert): " + error.message, "error"); return null; }
  return data;
}

async function dbUpdateStudent(id, s){
  const client = sb(); if(!client) return false;
  const { error } = await client.from("students").update({
    name:   s.name,
    roll_no:s.roll_no || s.roll || "",
    dept:   s.dept   || "—",
    sem:    String(s.sem || "1"),
    div:    s.div    || "A"
  }).eq("id", id);
  if(error){ toast("DB error (student update): " + error.message, "error"); return false; }
  return true;
}

async function dbDeleteStudent(id){
  const client = sb(); if(!client) return false;
  const { error } = await client.from("students").delete().eq("id", id);
  if(error){ toast("DB error (student delete): " + error.message, "error"); return false; }
  return true;
}

/* ---------- Teachers ---------- */

async function fetchTeachers(){
  const client = sb(); if(!client) return [];
  const { data, error } = await client.from("teachers").select("*").order("created_at", {ascending:true});
  if(error){ console.error("fetchTeachers:", error); return []; }
  return data || [];
}

async function dbInsertTeacher(t){
  const client = sb(); if(!client) return null;
  const { data, error } = await client.from("teachers").insert([{
    name:    t.name,
    subject: t.subject || "—",
    email:   t.email   || "—"
  }]).select().single();
  if(error){ toast("DB error (teacher insert): " + error.message, "error"); return null; }
  return data;
}

async function dbUpdateTeacher(id, t){
  const client = sb(); if(!client) return false;
  const { error } = await client.from("teachers").update({
    name:    t.name,
    subject: t.subject || "—",
    email:   t.email   || "—"
  }).eq("id", id);
  if(error){ toast("DB error (teacher update): " + error.message, "error"); return false; }
  return true;
}

async function dbDeleteTeacher(id){
  const client = sb(); if(!client) return false;
  const { error } = await client.from("teachers").delete().eq("id", id);
  if(error){ toast("DB error (teacher delete): " + error.message, "error"); return false; }
  return true;
}

/* ---------- Classrooms ---------- */

async function fetchClassrooms(){
  const client = sb(); if(!client) return [];
  const { data, error } = await client.from("classrooms").select("*").order("created_at", {ascending:true});
  if(error){ console.error("fetchClassrooms:", error); return []; }
  return data || [];
}

async function dbInsertClassroom(r){
  const client = sb(); if(!client) return null;
  const { data, error } = await client.from("classrooms").insert([{
    room:       r.room,
    capacity:   Number(r.capacity),
    smartboard: Boolean(r.smartboard),
    projector:  Boolean(r.projector),
    wifi:       Boolean(r.wifi),
    ac:         Boolean(r.ac),
    status:     r.status || "Available"
  }]).select().single();
  if(error){ toast("DB error (classroom insert): " + error.message, "error"); return null; }
  return data;
}

async function dbUpdateClassroom(id, r){
  const client = sb(); if(!client) return false;
  const { error } = await client.from("classrooms").update({
    room:       r.room,
    capacity:   Number(r.capacity),
    smartboard: Boolean(r.smartboard),
    projector:  Boolean(r.projector),
    wifi:       Boolean(r.wifi),
    ac:         Boolean(r.ac),
    status:     r.status || "Available"
  }).eq("id", id);
  if(error){ toast("DB error (classroom update): " + error.message, "error"); return false; }
  return true;
}

async function dbDeleteClassroom(id){
  const client = sb(); if(!client) return false;
  const { error } = await client.from("classrooms").delete().eq("id", id);
  if(error){ toast("DB error (classroom delete): " + error.message, "error"); return false; }
  return true;
}

/* ---------- Timetable ---------- */

async function fetchTimetable(){
  const client = sb(); if(!client) return [];
  const { data, error } = await client.from("timetable").select("*").order("created_at", {ascending:true});
  if(error){ console.error("fetchTimetable:", error); return []; }
  return data || [];
}

async function dbInsertTimetable(entry){
  const client = sb(); if(!client) return null;
  const { data, error } = await client.from("timetable").insert([{
    day:     entry.day,
    time:    entry.time,
    subject: entry.subject,
    teacher: entry.teacher,
    room:    entry.room,
    sem:     String(entry.sem || "5"),
    div:     entry.div || "A"
  }]).select().single();
  if(error){ toast("DB error (timetable insert): " + error.message, "error"); return null; }
  return data;
}

async function dbUpdateTimetable(id, entry){
  const client = sb(); if(!client) return false;
  const { error } = await client.from("timetable").update({
    day:     entry.day,
    time:    entry.time,
    subject: entry.subject,
    teacher: entry.teacher,
    room:    entry.room,
    sem:     String(entry.sem || "5"),
    div:     entry.div || "A"
  }).eq("id", id);
  if(error){ toast("DB error (timetable update): " + error.message, "error"); return false; }
  return true;
}

async function dbDeleteTimetable(id){
  const client = sb(); if(!client) return false;
  const { error } = await client.from("timetable").delete().eq("id", id);
  if(error){ toast("DB error (timetable delete): " + error.message, "error"); return false; }
  return true;
}

/* ---------- Notifications ---------- */

async function fetchNotifications(teacherName){
  const client = sb(); if(!client) return [];
  let q = client.from("notifications").select("*").order("created_at", {ascending:false});
  if(teacherName) q = q.eq("teacher", teacherName);
  const { data, error } = await q;
  if(error){ console.error("fetchNotifications:", error); return []; }
  return data || [];
}

async function dbInsertNotification(teacherName, message){
  const client = sb(); if(!client) return null;
  const { data, error } = await client.from("notifications").insert([{
    teacher: teacherName,
    message,
    read:    false
  }]).select().single();
  if(error){ console.error("dbInsertNotification:", error); return null; }
  return data;
}

async function dbMarkNotificationsRead(teacherName){
  const client = sb(); if(!client) return false;
  const { error } = await client.from("notifications")
    .update({ read: true })
    .eq("teacher", teacherName)
    .eq("read", false);
  if(error){ console.error("dbMarkNotificationsRead:", error); return false; }
  return true;
}

async function dbDeleteNotifications(teacherName){
  const client = sb(); if(!client) return false;
  const { error } = await client.from("notifications").delete().eq("teacher", teacherName);
  if(error){ console.error("dbDeleteNotifications:", error); return false; }
  return true;
}

/* ================================================================
   IN-MEMORY STATE (loaded from Supabase on dashboard init,
   used for conflict checks and local renders without re-fetching)
   ================================================================ */

let _students   = [];
let _teachers   = [];
let _classrooms = [];
let _timetable  = [];
let _notifications = [];

async function loadAllData(){
  [_students, _teachers, _classrooms, _timetable] = await Promise.all([
    fetchStudents(), fetchTeachers(), fetchClassrooms(), fetchTimetable()
  ]);
}

/* ================================================================
   NOTIFICATIONS (push + render)
   ================================================================ */

async function pushNotification(teacherName, message){
  await dbInsertNotification(teacherName, message);
  const user = getCurrentUser();
  if(user && user.name === teacherName){
    _notifications = await fetchNotifications(teacherName);
    renderTeacherNotifications();
  }
}

async function markNotificationsRead(){
  const user = getCurrentUser();
  if(!user) return;
  await dbMarkNotificationsRead(user.name);
  _notifications = _notifications.map(n => ({...n, read:true}));
  renderTeacherNotifications();
  toast("Notifications cleared.", "info");
}

/* Used by notifications.html page */
function getAllNotifications(){ return _notifications; }

function renderTeacherNotifications(){
  const list  = $("#notificationsList");
  if(!list) return;
  const user  = getCurrentUser();
  if(!user) return;
  const mine  = _notifications.filter(n => n.teacher === user.name);
  const unread= mine.filter(n => !n.read).length;

  const badgeEl = $("#unreadBadge");
  if(badgeEl){
    badgeEl.style.display = unread ? "inline-flex" : "none";
    badgeEl.textContent   = `${unread} new`;
  }

  list.innerHTML = mine.length
    ? ""
    : `<p class="muted">No notifications yet. You'll see a message here if an admin changes one of your lectures.</p>`;

  mine.forEach(n=>{
    const div = document.createElement("div");
    div.className = "notice";
    if(!n.read) div.style.borderLeftColor = "var(--accent-3)";
    const when = new Date(n.created_at || Date.now()).toLocaleString();
    div.innerHTML = `${n.read ? "" : "<b>● New —</b> "}${n.message} <div class="muted" style="margin-top:4px;">${when}</div>`;
    list.appendChild(div);
  });
}

/* ================================================================
   DASHBOARD STATS
   ================================================================ */

function renderDashboardStats(){
  const today = todayName();
  const setStat = (id, val) => { const el = $(id); if(el) el.textContent = val; };
  setStat("#statStudents",  _students.length);
  setStat("#statTeachers",  _teachers.length);
  setStat("#statClassrooms",_classrooms.length);
  setStat("#statToday",     _timetable.filter(t => t.day === today).length);
}

/* ================================================================
   ADMIN: STUDENTS CRUD
   ================================================================ */

let editingStudentId = null;

function renderStudents(){
  const tbody = $("#studentsBody");
  if(!tbody) return;
  tbody.innerHTML = _students.length
    ? ""
    : `<tr class="empty-row"><td colspan="6">No students added yet.</td></tr>`;
  _students.forEach(s=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${s.name}</td>
      <td>${s.roll_no || s.roll || ""}</td>
      <td>${s.dept || "—"}</td>
      <td>${s.sem  || "—"}</td>
      <td>${s.div  || "—"}</td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" title="Edit"   onclick="editStudent('${s.id}')">✏️</button>
          <button class="icon-btn del" title="Delete" onclick="deleteStudent('${s.id}')">🗑️</button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
}

async function saveStudent(){
  const name = ($("#studentName")||{value:""}).value.trim();
  const roll = ($("#studentRoll")||{value:""}).value.trim();
  const dept = ($("#studentDept")||{value:"Information Technology"}).value.trim() || "Information Technology";
  const sem  = ($("#studentSem") ||{value:"1"}).value;
  const div  = ($("#studentDiv") ||{value:"A"}).value;

  if(!/^[A-Za-z ]+$/.test(name) || name.length < 2){
    toast("Enter a valid student name (letters only, min 2 characters).", "error");
    return;
  }
  if(roll === ""){
    toast("Roll number is required.", "error");
    return;
  }

  if(editingStudentId){
    const ok = await dbUpdateStudent(editingStudentId, { name, roll_no:roll, dept, sem, div });
    if(!ok) return;
    const idx = _students.findIndex(s => s.id === editingStudentId);
    if(idx > -1) _students[idx] = { ..._students[idx], name, roll_no:roll, dept, sem, div };
    toast("Student updated.", "success");
    editingStudentId = null;
    const btn = $("#studentSubmitBtn"); if(btn) btn.textContent = "➕ Add Student";
  } else {
    const dup = _students.find(s => s.roll_no === roll || s.roll === roll);
    if(dup){ toast("A student with this roll number already exists.", "error"); return; }
    const created = await dbInsertStudent({ name, roll_no:roll, dept, sem, div });
    if(!created) return;
    _students.push(created);
    toast("Student added.", "success");
  }

  clearStudentForm();
  renderStudents();
  renderDashboardStats();
}

function editStudent(id){
  const s = _students.find(x => x.id === id);
  if(!s) return;
  editingStudentId = id;
  const set = (sel, val) => { const el = $(sel); if(el) el.value = val; };
  set("#studentName", s.name);
  set("#studentRoll", s.roll_no || s.roll || "");
  set("#studentDept", s.dept || "");
  set("#studentSem",  s.sem  || "1");
  set("#studentDiv",  s.div  || "A");
  const btn = $("#studentSubmitBtn"); if(btn) btn.textContent = "💾 Save Changes";
  const el  = $("#studentName"); if(el) el.scrollIntoView({ behavior:"smooth", block:"center" });
}

async function deleteStudent(id){
  if(!confirm("Remove this student record?")) return;
  const ok = await dbDeleteStudent(id);
  if(!ok) return;
  _students = _students.filter(s => s.id !== id);
  renderStudents();
  renderDashboardStats();
  toast("Student removed.", "info");
}

function clearStudentForm(){
  ["#studentName","#studentRoll","#studentDept"].forEach(sel => { const el = $(sel); if(el) el.value = ""; });
  editingStudentId = null;
  const btn = $("#studentSubmitBtn"); if(btn) btn.textContent = "➕ Add Student";
}

/* ================================================================
   ADMIN: TEACHERS CRUD
   ================================================================ */

let editingTeacherId = null;

function renderTeachers(){
  const tbody = $("#teachersBody");
  if(!tbody) return;
  tbody.innerHTML = _teachers.length
    ? ""
    : `<tr class="empty-row"><td colspan="3">No teachers registered yet. Teachers appear here automatically when they sign up.</td></tr>`;
  _teachers.forEach(t=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${t.name}</td>
      <td>${t.subject || "—"}</td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" title="Edit"   onclick="editTeacher('${t.id}')">✏️</button>
          <button class="icon-btn del" title="Delete" onclick="deleteTeacher('${t.id}')">🗑️</button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
  populateAdminTimetableSelectors();
}

async function saveTeacher(){
  const name    = ($("#teacherName")   ||{value:""}).value.trim();
  const subject = ($("#teacherSubject")||{value:""}).value.trim();

  if(!/^[A-Za-z .]+$/.test(name) || name.length < 2){
    toast("Enter a valid teacher name.", "error");
    return;
  }
  if(subject === ""){
    toast("Subject is required.", "error");
    return;
  }

  if(editingTeacherId){
    const ok = await dbUpdateTeacher(editingTeacherId, { name, subject });
    if(!ok) return;
    const idx = _teachers.findIndex(t => t.id === editingTeacherId);
    if(idx > -1) _teachers[idx] = { ..._teachers[idx], name, subject };
    toast("Teacher updated.", "success");
    editingTeacherId = null;
    const btn = $("#teacherSubmitBtn"); if(btn) btn.textContent = "➕ Add Teacher";
  } else {
    const dup = _teachers.find(t => t.name === name);
    if(dup){ toast("A teacher with this name already exists.", "error"); return; }
    const created = await dbInsertTeacher({ name, subject });
    if(!created) return;
    _teachers.push(created);
    toast("Teacher added.", "success");
  }

  clearTeacherForm();
  renderTeachers();
  renderDashboardStats();
}

function editTeacher(id){
  const t = _teachers.find(x => x.id === id);
  if(!t) return;
  editingTeacherId = id;
  const set = (sel, val) => { const el = $(sel); if(el) el.value = val; };
  set("#teacherName",    t.name);
  set("#teacherSubject", t.subject || "");
  const btn = $("#teacherSubmitBtn"); if(btn) btn.textContent = "💾 Save Changes";
  const el  = $("#teacherName"); if(el) el.scrollIntoView({ behavior:"smooth", block:"center" });
}

async function deleteTeacher(id){
  if(!confirm("Remove this teacher record?")) return;
  const ok = await dbDeleteTeacher(id);
  if(!ok) return;
  _teachers = _teachers.filter(t => t.id !== id);
  renderTeachers();
  renderDashboardStats();
  toast("Teacher removed.", "info");
}

function clearTeacherForm(){
  ["#teacherName","#teacherSubject"].forEach(sel => { const el = $(sel); if(el) el.value = ""; });
  editingTeacherId = null;
  const btn = $("#teacherSubmitBtn"); if(btn) btn.textContent = "➕ Add Teacher";
}

/* ================================================================
   CLASSROOM STATUS (read-only — Teacher & Student dashboards)
   ================================================================ */

function renderClassroomStatusReadOnly(containerId){
  const wrap = $("#" + containerId);
  if(!wrap) return;
  wrap.innerHTML = _classrooms.length ? "" : `<p class="muted">No classrooms have been added yet.</p>`;
  _classrooms.forEach(r=>{
    const div = document.createElement("div");
    div.className = "card punched";
    div.innerHTML = `
      <h3>🏫 ${r.room} <span class="badge ${r.status==='Available'?'available':'occupied'}" style="margin-left:auto;">${r.status}</span></h3>
      <p class="muted">Capacity: ${r.capacity} students</p>
      <div class="tag-row">
        <span class="badge ${r.smartboard?'on':'off'}">🖥️ Smart Board</span>
        <span class="badge ${r.projector?'on':'off'}">📽️ Projector</span>
        <span class="badge ${r.wifi?'on':'off'}">📶 WiFi</span>
        <span class="badge ${r.ac?'on':'off'}">❄️ AC</span>
      </div>`;
    wrap.appendChild(div);
  });
}

/* ================================================================
   ADMIN: CLASSROOMS CRUD
   ================================================================ */

let editingRoomId = null;

function badge(bool){
  return `<span class="badge ${bool ? 'on' : 'off'}">${bool ? 'Yes' : 'No'}</span>`;
}

function renderClassrooms(){
  const tbody    = $("#classroomsBody");
  const cardsWrap= $("#classroomCards");

  if(tbody){
    tbody.innerHTML = _classrooms.length
      ? ""
      : `<tr class="empty-row"><td colspan="8">No classrooms added yet.</td></tr>`;
    _classrooms.forEach(r=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.room}</td>
        <td>${r.capacity}</td>
        <td>${badge(r.smartboard)}</td>
        <td>${badge(r.projector)}</td>
        <td>${badge(r.wifi)}</td>
        <td>${badge(r.ac)}</td>
        <td><span class="badge ${r.status === 'Available' ? 'available' : 'occupied'}">${r.status}</span></td>
        <td>
          <div class="row-actions">
            <button class="icon-btn" title="Toggle" onclick="toggleRoomStatus('${r.id}')">🔁</button>
            <button class="icon-btn" title="Edit"   onclick="editRoom('${r.id}')">✏️</button>
            <button class="icon-btn del" title="Delete" onclick="deleteRoom('${r.id}')">🗑️</button>
          </div>
        </td>`;
      tbody.appendChild(tr);
    });
  }

  if(cardsWrap){
    cardsWrap.innerHTML = "";
    _classrooms.forEach(r=>{
      const div = document.createElement("div");
      div.className = "card punched";
      div.innerHTML = `
        <h3>🏫 ${r.room} <span class="badge ${r.status==='Available'?'available':'occupied'}" style="margin-left:auto;">${r.status}</span></h3>
        <p class="muted">Capacity: ${r.capacity} students</p>
        <div class="tag-row">
          <span class="badge ${r.smartboard?'on':'off'}">🖥️ Smart Board</span>
          <span class="badge ${r.projector?'on':'off'}">📽️ Projector</span>
          <span class="badge ${r.wifi?'on':'off'}">📶 WiFi</span>
          <span class="badge ${r.ac?'on':'off'}">❄️ AC</span>
        </div>`;
      cardsWrap.appendChild(div);
    });
  }
  populateAdminTimetableSelectors();
}

async function saveRoom(){
  const room       = ($("#roomName")||{value:""}).value.trim();
  const capacity   = parseInt(($("#roomCapacity")||{value:"0"}).value, 10) || 0;
  const smartboard = ($("#roomSmartboard")||{checked:false}).checked;
  const projector  = ($("#roomProjector") ||{checked:false}).checked;
  const wifi       = ($("#roomWifi")      ||{checked:false}).checked;
  const ac         = ($("#roomAc")        ||{checked:false}).checked;
  const status     = ($("#roomStatus")    ||{value:"Available"}).value;

  if(room === ""){    toast("Classroom name is required.", "error"); return; }
  if(capacity <= 0){  toast("Enter a valid capacity.", "error");     return; }

  if(editingRoomId){
    const ok = await dbUpdateClassroom(editingRoomId, { room, capacity, smartboard, projector, wifi, ac, status });
    if(!ok) return;
    const idx = _classrooms.findIndex(r => r.id === editingRoomId);
    if(idx > -1) _classrooms[idx] = { ..._classrooms[idx], room, capacity, smartboard, projector, wifi, ac, status };
    toast("Classroom updated.", "success");
    editingRoomId = null;
    const btn = $("#roomSubmitBtn"); if(btn) btn.textContent = "➕ Add Classroom";
  } else {
    const created = await dbInsertClassroom({ room, capacity, smartboard, projector, wifi, ac, status });
    if(!created) return;
    _classrooms.push(created);
    toast("Classroom added.", "success");
  }

  clearRoomForm();
  renderClassrooms();
  renderDashboardStats();
}

function editRoom(id){
  const r = _classrooms.find(x => x.id === id);
  if(!r) return;
  editingRoomId = id;
  const set = (sel, val) => { const el = $(sel); if(el) el.value = val; };
  set("#roomName",     r.room);
  set("#roomCapacity", r.capacity);
  set("#roomStatus",   r.status);
  const setCk = (sel, val) => { const el = $(sel); if(el) el.checked = val; };
  setCk("#roomSmartboard", r.smartboard);
  setCk("#roomProjector",  r.projector);
  setCk("#roomWifi",       r.wifi);
  setCk("#roomAc",         r.ac);
  const btn = $("#roomSubmitBtn"); if(btn) btn.textContent = "💾 Save Changes";
  const el  = $("#roomName"); if(el) el.scrollIntoView({ behavior:"smooth", block:"center" });
}

async function toggleRoomStatus(id){
  const r = _classrooms.find(x => x.id === id);
  if(!r) return;
  const newStatus = r.status === "Available" ? "Occupied" : "Available";
  const ok = await dbUpdateClassroom(id, { ...r, status: newStatus });
  if(!ok) return;
  r.status = newStatus;
  renderClassrooms();
}

async function deleteRoom(id){
  if(!confirm("Remove this classroom?")) return;
  const ok = await dbDeleteClassroom(id);
  if(!ok) return;
  _classrooms = _classrooms.filter(r => r.id !== id);
  renderClassrooms();
  renderDashboardStats();
  toast("Classroom removed.", "info");
}

function clearRoomForm(){
  const set = (sel, val) => { const el = $(sel); if(el) el.value = val; };
  set("#roomName",""); set("#roomCapacity",""); set("#roomStatus","Available");
  ["#roomSmartboard","#roomProjector","#roomWifi","#roomAc"].forEach(sel => { const el = $(sel); if(el) el.checked = false; });
  editingRoomId = null;
  const btn = $("#roomSubmitBtn"); if(btn) btn.textContent = "➕ Add Classroom";
}

/* ================================================================
   TIMETABLE: CONFLICT CHECK
   ================================================================ */

function hasConflict(day, time, room, teacherName, excludeId){
  return _timetable.some(t =>
    t.id !== excludeId &&
    t.day === day && t.time === time &&
    (t.room === room || t.teacher === teacherName)
  );
}

/* ================================================================
   TEACHER: MANUAL ADD / EDIT / DELETE (own lectures only)
   ================================================================ */

let editingLectureId = null;

async function saveLecture(){
  const user    = getCurrentUser();
  const subject = ($("#subject") ||{value:""}).value.trim();
  const sem     = ($("#lecSem")  ||{value:"5"}).value;
  const div     = ($("#lecDiv")  ||{value:"A"}).value;
  const room    = ($("#room")    ||{value:""}).value;
  const day     = ($("#lecDay")  ||{value:"Monday"}).value;
  const time    = ($("#time")    ||{value:""}).value;

  if(subject === ""){ toast("Please enter a subject.", "error"); return; }

  if(editingLectureId){
    const original = _timetable.find(t => t.id === editingLectureId);
    if(!original || original.teacher !== user.name){
      toast("You can only edit your own lectures.", "error"); return;
    }
    if(hasConflict(day, time, room, user.name, editingLectureId)){
      toast(`Clash detected: ${room} or ${user.name} is already booked on ${day} at ${time}.`, "error"); return;
    }
    const ok = await dbUpdateTimetable(editingLectureId, { day, time, subject, teacher:user.name, room, sem, div });
    if(!ok) return;
    const idx = _timetable.findIndex(t => t.id === editingLectureId);
    if(idx > -1) _timetable[idx] = { ..._timetable[idx], day, time, subject, room, sem, div };
    toast("Lecture updated.", "success");
    editingLectureId = null;
    const btn = $("#lectureSubmitBtn"); if(btn) btn.textContent = "📌 Add to Timetable";
  } else {
    if(hasConflict(day, time, room, user.name)){
      toast(`Clash detected: ${room} or ${user.name} is already booked on ${day} at ${time}.`, "error"); return;
    }
    const created = await dbInsertTimetable({ day, time, subject, teacher:user.name, room, sem, div });
    if(!created) return;
    _timetable.push(created);
    toast("Lecture scheduled successfully!", "success");
  }

  const el = $("#subject"); if(el) el.value = "";
  renderTeacherLectures();
}

function editLecture(id){
  const user    = getCurrentUser();
  const lecture = _timetable.find(t => t.id === id);
  if(!lecture || lecture.teacher !== user.name){
    toast("You can only edit your own lectures.", "error"); return;
  }
  editingLectureId = id;
  const set = (sel, val) => { const el = $(sel); if(el) el.value = val; };
  set("#subject", lecture.subject);
  set("#lecSem",  lecture.sem);
  set("#lecDiv",  lecture.div);
  set("#room",    lecture.room);
  set("#lecDay",  lecture.day);
  set("#time",    lecture.time);
  const btn = $("#lectureSubmitBtn"); if(btn) btn.textContent = "💾 Save Changes";
  const el  = $("#subject"); if(el) el.scrollIntoView({ behavior:"smooth", block:"center" });
}

async function deleteLecture(id){
  const user    = getCurrentUser();
  const lecture = _timetable.find(t => t.id === id);
  if(!lecture || lecture.teacher !== user.name){
    toast("You can only delete your own lectures.", "error"); return;
  }
  if(!confirm("Remove this lecture from the timetable?")) return;
  const ok = await dbDeleteTimetable(id);
  if(!ok) return;
  _timetable = _timetable.filter(t => t.id !== id);
  if(editingLectureId === id){
    editingLectureId = null;
    const btn = $("#lectureSubmitBtn"); if(btn) btn.textContent = "📌 Add to Timetable";
  }
  renderTeacherLectures();
  toast("Lecture removed.", "info");
}

function renderTeacherLectures(){
  const tbody = $("#lectureBody");
  if(!tbody) return;
  const user = getCurrentUser();
  const rows = _timetable.filter(t => t.teacher === user.name);
  tbody.innerHTML = rows.length
    ? ""
    : `<tr class="empty-row"><td colspan="7">No lectures scheduled yet. Add one above, or generate a full week automatically.</td></tr>`;
  rows.forEach(t=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${t.day}</td>
      <td>${t.time}</td>
      <td>${t.subject}</td>
      <td>${t.room}</td>
      <td>Sem ${t.sem}</td>
      <td>${t.div || "A"}</td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" title="Edit"   onclick="editLecture('${t.id}')">✏️</button>
          <button class="icon-btn del" title="Delete" onclick="deleteLecture('${t.id}')">🗑️</button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
}

/* ================================================================
   ADMIN: FULL TIMETABLE CRUD
   ================================================================ */

let editingAdminLectureId = null;

function populateAdminTimetableSelectors(){
  const teacherSel = $("#ttTeacher");
  const roomSel    = $("#ttRoom");
  if(!teacherSel || !roomSel) return;

  // Show all known teacher names: from DB + from timetable entries (in case a teacher
  // signed in via Login before Supabase was integrated)
  const dbNames = _teachers.map(t => t.name);
  const ttNames = _timetable.map(t => t.teacher);
  const teacherNames = Array.from(new Set([...dbNames, ...ttNames])).filter(Boolean);

  teacherSel.innerHTML = teacherNames.length
    ? teacherNames.map(n => `<option value="${n}">${n}</option>`).join("")
    : `<option value="">No teachers registered yet</option>`;

  roomSel.innerHTML = _classrooms.length
    ? _classrooms.map(r => `<option value="${r.room}">${r.room}</option>`).join("")
    : `<option value="">Add a classroom first</option>`;
}

async function adminSaveLecture(){
  const subject = ($("#ttSubject")||{value:""}).value.trim();
  const teacher = ($("#ttTeacher")||{value:""}).value;
  const room    = ($("#ttRoom")   ||{value:""}).value;
  const day     = ($("#ttDay")    ||{value:"Monday"}).value;
  const time    = ($("#ttTime")   ||{value:""}).value;
  const sem     = ($("#ttSem")    ||{value:"5"}).value;

  if(subject === ""){ toast("Please enter a subject.", "error"); return; }
  if(teacher === ""){ toast("Add at least one teacher before scheduling a lecture.", "error"); return; }

  if(editingAdminLectureId){
    const original = _timetable.find(t => t.id === editingAdminLectureId);
    if(hasConflict(day, time, room, teacher, editingAdminLectureId)){
      toast(`Clash detected: ${room} or ${teacher} is already booked on ${day} at ${time}.`, "error"); return;
    }
    const ok = await dbUpdateTimetable(editingAdminLectureId, { day, time, subject, teacher, room, sem, div:"A" });
    if(!ok) return;
    const idx = _timetable.findIndex(t => t.id === editingAdminLectureId);
    if(idx > -1) _timetable[idx] = { ..._timetable[idx], day, time, subject, teacher, room, sem };

    if(original){
      await pushNotification(original.teacher,
        `An admin updated your ${original.subject} lecture (was ${original.day}, ${original.time}). It's now "${subject}" on ${day} at ${time} in ${room}.`);
      if(teacher !== original.teacher){
        await pushNotification(teacher, `An admin assigned you a new lecture: ${subject} on ${day} at ${time} in ${room}.`);
      }
    }
    toast("Lecture updated and teacher notified.", "success");
    editingAdminLectureId = null;
    const btn = $("#ttSubmitBtn"); if(btn) btn.textContent = "➕ Add Lecture";
  } else {
    if(hasConflict(day, time, room, teacher)){
      toast(`Clash detected: ${room} or ${teacher} is already booked on ${day} at ${time}.`, "error"); return;
    }
    const created = await dbInsertTimetable({ day, time, subject, teacher, room, sem, div:"A" });
    if(!created) return;
    _timetable.push(created);
    await pushNotification(teacher, `An admin scheduled a new lecture for you: ${subject} on ${day} at ${time} in ${room}.`);
    toast("Lecture added and teacher notified.", "success");
  }

  const el = $("#ttSubject"); if(el) el.value = "";
  renderAdminTimetable();
  renderDashboardStats();
}

function adminEditLecture(id){
  const t = _timetable.find(x => x.id === id);
  if(!t) return;
  editingAdminLectureId = id;
  const set = (sel, val) => { const el = $(sel); if(el) el.value = val; };
  set("#ttSubject", t.subject);
  set("#ttTeacher", t.teacher);
  set("#ttRoom",    t.room);
  set("#ttDay",     t.day);
  set("#ttTime",    t.time);
  set("#ttSem",     t.sem);
  const btn = $("#ttSubmitBtn"); if(btn) btn.textContent = "💾 Save Changes";
  const el  = $("#ttSubject"); if(el) el.scrollIntoView({ behavior:"smooth", block:"center" });
}

async function adminDeleteLecture(id){
  const t = _timetable.find(x => x.id === id);
  if(!t) return;
  if(!confirm(`Remove ${t.subject} (${t.day}, ${t.time}) from ${t.teacher}'s timetable?`)) return;
  const ok = await dbDeleteTimetable(id);
  if(!ok) return;
  _timetable = _timetable.filter(x => x.id !== id);
  await pushNotification(t.teacher, `An admin removed your ${t.subject} lecture on ${t.day} at ${t.time}.`);
  if(editingAdminLectureId === id){
    editingAdminLectureId = null;
    const btn = $("#ttSubmitBtn"); if(btn) btn.textContent = "➕ Add Lecture";
  }
  renderAdminTimetable();
  renderDashboardStats();
  toast("Lecture removed and teacher notified.", "info");
}

function renderAdminTimetable(){
  const tbody = $("#adminTimetableBody");
  if(!tbody) return;
  const rows = _timetable.slice().sort((a,b)=>
    DAYS.indexOf(a.day)-DAYS.indexOf(b.day) || SLOTS.indexOf(a.time)-SLOTS.indexOf(b.time)
  );
  tbody.innerHTML = rows.length
    ? ""
    : `<tr class="empty-row"><td colspan="7">No lectures scheduled yet.</td></tr>`;
  rows.forEach(t=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${t.day}</td>
      <td>${t.time}</td>
      <td>${t.subject}</td>
      <td>${t.teacher}</td>
      <td>${t.room}</td>
      <td>Sem ${t.sem}</td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" title="Edit"   onclick="adminEditLecture('${t.id}')">✏️</button>
          <button class="icon-btn del" title="Delete" onclick="adminDeleteLecture('${t.id}')">🗑️</button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
}

/* ================================================================
   AI TIMETABLE GENERATOR (conflict-free)
   ================================================================ */

async function generateAITimetable(scopeTeacherOnly){
  const user        = getCurrentUser();
  const rooms       = _classrooms.map(r => r.room);
  const teacherName = user && user.role === "teacher" ? user.name : null;

  if(!rooms.length){
    toast("Add at least one classroom before generating a timetable.", "error"); return;
  }

  // Build local working copy
  let workingTT = [..._timetable];

  if(scopeTeacherOnly && teacherName){
    // Delete this teacher's existing slots from DB
    const mySlots = workingTT.filter(t => t.teacher === teacherName);
    await Promise.all(mySlots.map(t => dbDeleteTimetable(t.id)));
    workingTT = workingTT.filter(t => t.teacher !== teacherName);
    editingLectureId = null;
    const btn = $("#lectureSubmitBtn"); if(btn) btn.textContent = "📌 Add to Timetable";
  }

  const newEntries = [];
  for(const day of DAYS){
    for(const time of SLOTS){
      const bookedRooms    = new Set(workingTT.filter(t => t.day===day && t.time===time).map(t=>t.room));
      const bookedTeachers = new Set(workingTT.filter(t => t.day===day && t.time===time).map(t=>t.teacher));

      const availableRooms = rooms.filter(r => !bookedRooms.has(r));
      if(!availableRooms.length) continue;

      const room    = availableRooms[Math.floor(Math.random()*availableRooms.length)];
      const subject = SUBJECT_POOL[Math.floor(Math.random()*SUBJECT_POOL.length)];

      let teacher = teacherName;
      if(!teacher){
        const allTeacherNames   = _teachers.map(t=>t.name);
        const availableTeachers = allTeacherNames.filter(n => !bookedTeachers.has(n));
        teacher = availableTeachers.length
          ? availableTeachers[Math.floor(Math.random()*availableTeachers.length)]
          : (allTeacherNames[0] || "Staff");
        if(bookedTeachers.has(teacher)) continue;
      }

      const entry = { day, time, subject, teacher, room, sem:"5", div:"A" };
      newEntries.push(entry);
      workingTT.push({ ...entry, id:"tmp_"+uid() }); // track locally for conflict avoidance
    }
  }

  // Insert all new entries into Supabase
  let inserted = [];
  if(sb() && newEntries.length){
    const { data, error } = await sb().from("timetable").insert(
      newEntries.map(e => ({ day:e.day, time:e.time, subject:e.subject, teacher:e.teacher, room:e.room, sem:e.sem, div:e.div }))
    ).select();
    if(error){
      toast("AI timetable DB error: " + error.message, "error");
      return;
    }
    inserted = data || [];
  } else {
    inserted = newEntries.map(e => ({ ...e, id:uid() }));
  }

  // Refresh in-memory timetable
  _timetable = scopeTeacherOnly && teacherName
    ? [...workingTT.filter(t => !t.id.toString().startsWith("tmp_")), ...inserted]
    : inserted;

  // Full re-fetch to get clean IDs
  _timetable = await fetchTimetable();

  toast("✅ AI Timetable generated — conflicts avoided automatically!", "success");

  if(!scopeTeacherOnly && user && user.role === "admin"){
    await Promise.all(_teachers.map(t =>
      pushNotification(t.name, "An admin regenerated the full-college AI timetable. Please check your schedule for changes.")
    ));
  }

  renderTeacherLectures();
  renderTeacherNotifications();
  renderFullTimetable();
  renderStudentTimetable();
  renderMiniTimetable(true);
  renderAdminTimetable();
}

/* ================================================================
   FULL TIMETABLE VIEW
   ================================================================ */

function renderFullTimetable(filter){
  const grid = $("#fullTimetableGrid");
  if(!grid) return;
  const query = (filter || "").trim().toLowerCase();

  let html = `<div class="tt-cell head">Time</div>`;
  DAYS.forEach(d => html += `<div class="tt-cell head">${d}</div>`);

  SLOTS.forEach(time=>{
    html += `<div class="tt-cell time">${time}</div>`;
    DAYS.forEach(day=>{
      const entry = _timetable.find(t => t.day === day && t.time === time);
      if(!entry){ html += `<div class="tt-cell slot empty">Free</div>`; return; }
      const matches = query && (entry.subject.toLowerCase().includes(query) || day.toLowerCase().includes(query));
      html += `<div class="tt-cell slot ${matches ? 'match' : ''}">
        <span class="subj">${entry.subject}</span>
        <span class="meta">${entry.teacher} · ${entry.room}</span>
      </div>`;
    });
  });

  grid.innerHTML = html;
}

function searchFullTimetable(){
  const q = ($("#ttSearch")||{value:""}).value;
  renderFullTimetable(q);
}

/* ================================================================
   STUDENT DASHBOARD
   ================================================================ */

function renderStudentTimetable(){
  const tbody = $("#studentTodayBody");
  if(!tbody) return;
  const day  = todayName();
  const rows = _timetable.filter(t => t.day === day).sort((a,b)=> SLOTS.indexOf(a.time)-SLOTS.indexOf(b.time));
  const lbl  = $("#todayLabel"); if(lbl) lbl.textContent = day;
  tbody.innerHTML = rows.length
    ? ""
    : `<tr class="empty-row"><td colspan="3">No lectures scheduled for today.</td></tr>`;
  rows.forEach(t=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${t.time}</td><td>${t.subject}</td><td>${t.room}</td>`;
    tbody.appendChild(tr);
  });
}

function searchStudentTimetable(){
  const q     = (($("#studentSearch")||{value:""}).value).trim().toLowerCase();
  const tbody = $("#studentSearchBody");
  if(!tbody) return;
  const rows = _timetable.filter(t =>
    t.subject.toLowerCase().includes(q) || t.day.toLowerCase().includes(q)
  );
  tbody.innerHTML = rows.length
    ? ""
    : `<tr class="empty-row"><td colspan="5">No matching classes found.</td></tr>`;
  rows.forEach(t=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${t.day}</td><td>${t.time}</td><td>${t.subject}</td><td>${t.teacher}</td><td>${t.room}</td>`;
    tbody.appendChild(tr);
  });
}

/* ================================================================
   HERO MINI TIMETABLE ANIMATION
   ================================================================ */

function renderMiniTimetable(regenerate){
  const grid = $("#miniGrid");
  if(!grid) return;
  const shortDays = ["MON","TUE","WED","THU","FRI"];
  let html = `<div class="cell head">TIME</div>`;
  shortDays.forEach(d => html += `<div class="cell head">${d}</div>`);
  for(let r=0;r<4;r++){
    html += `<div class="cell">P${r+1}</div>`;
    for(let c=0;c<5;c++) html += `<div class="cell" data-r="${r}" data-c="${c}">·</div>`;
  }
  grid.innerHTML = html;
  const cells = $$(".cell[data-r]", grid);
  let i = 0;
  const fill = () => {
    if(i >= cells.length) return;
    const cell = cells[i];
    if(Math.random() < 0.8){
      cell.textContent = SUBJECT_POOL[Math.floor(Math.random()*SUBJECT_POOL.length)].split(" ")[0];
      cell.classList.add("filled");
    }
    i++;
    setTimeout(fill, 90);
  };
  fill();
}

/* ================================================================
   NAV ACTIVE STATE
   ================================================================ */

function markActiveNav(){
  const page = document.body.dataset.page;
  $$(".nav-links a").forEach(a=>{
    if(a.dataset.nav === page) a.classList.add("active");
  });
}

/* ================================================================
   REGISTRATION VALIDATION (alias used by registration.html)
   ================================================================ */
// validateRegistration() is already defined above — no alias needed.

/* ================================================================
   INIT DISPATCHER
   ================================================================ */

document.addEventListener("DOMContentLoaded", async () => {
  initTheme();
  markActiveNav();
  renderUserChip();

  const themeBtn = $("#themeToggle");
  if(themeBtn) themeBtn.addEventListener("click", toggleTheme);

  const page = document.body.dataset.page;

  /* ---------- HOME ---------- */
  if(page === "home"){
    renderMiniTimetable();
    // Load timetable for mini-grid background (non-blocking)
    fetchTimetable().then(data => { _timetable = data; }).catch(()=>{});

    const user   = getCurrentUser();
    const bell   = $("#notifBell");
    const dot    = $("#notifDot");
    const dashBtn= $("#dashboardBtn");

    if(user){
      if(dashBtn){
        dashBtn.style.display = "inline-flex";
        dashBtn.setAttribute("href",
          user.role === "admin"   ? "admin.html" :
          user.role === "teacher" ? "teacher.html" : "student.html");
      }
      if(bell && user.role === "teacher"){
        bell.style.display = "inline-flex";
        fetchNotifications(user.name).then(notes => {
          _notifications = notes;
          const unread = notes.filter(n => !n.read).length;
          if(dot) dot.style.display = unread > 0 ? "block" : "none";
        }).catch(()=>{});
      }
    }
  }

  /* ---------- LOGIN ---------- */
  if(page === "login"){
    const client = sb();
    if(client){
      const { data:{ session } } = await client.auth.getSession().catch(() => ({ data:{ session:null } }));
      if(session){
        const meta = session.user.user_metadata || {};
        const role = meta.role || localStorage.getItem(KEYS.role);
        if(role === "admin")        window.location.href = "admin.html";
        else if(role === "teacher") window.location.href = "teacher.html";
        else                        window.location.href = "student.html";
        return;
      }
    } else {
      const existing = getCurrentUser();
      if(existing){
        if(existing.role === "admin")        window.location.href = "admin.html";
        else if(existing.role === "teacher") window.location.href = "teacher.html";
        else                                 window.location.href = "student.html";
      }
    }
  }

  /* ---------- REGISTER ---------- */
  if(page === "register"){
    // form handles itself via validateRegistration()
  }

  /* ---------- ADMIN ---------- */
  if(page === "admin"){
    const user = await requireAuth(["admin"]);
    if(!user) return;
    const nd = $("#adminNameDisplay"); if(nd) nd.textContent = user.name;

    toast("Loading data…", "info");
    await loadAllData();

    renderDashboardStats();
    renderStudents();
    renderTeachers();
    renderClassrooms();
    renderAdminTimetable();
  }

  /* ---------- TEACHER ---------- */
  if(page === "teacher"){
    const user = await requireAuth(["teacher"]);
    if(!user) return;
    const nd  = $("#teacherNameDisplay"); if(nd)  nd.textContent = user.name;
    const pn  = $("#profileName");        if(pn)  pn.textContent = user.name;

    await loadAllData();
    _notifications = await fetchNotifications(user.name);

    renderTeacherLectures();
    renderTeacherNotifications();
    renderClassroomStatusReadOnly("teacherClassroomStatus");
  }

  /* ---------- STUDENT ---------- */
  if(page === "student"){
    const user = await requireAuth(["student"]);
    if(!user) return;
    const nd = $("#studentNameDisplay"); if(nd) nd.textContent = user.name;
    const pn = $("#profileName");        if(pn) pn.textContent = user.name;
    const pr = $("#profileRoll");        if(pr) pr.textContent = user.rollno || "—";

    await loadAllData();

    renderStudentTimetable();
    searchStudentTimetable();
    renderClassroomStatusReadOnly("studentClassroomStatus");
  }

  /* ---------- TIMETABLE ---------- */
  if(page === "timetable"){
    _timetable   = await fetchTimetable();
    _classrooms  = await fetchClassrooms();
    _teachers    = await fetchTeachers();

    const user = getCurrentUser();
    const btn  = $("#regenerateBtn");
    if(btn && user && user.role === "admin"){
      btn.style.display = "inline-flex";
      const hint = $("#editHint");
      if(hint) hint.textContent = "You're signed in as admin — regenerating rebuilds everyone's schedule and notifies every teacher.";
    }
    renderFullTimetable();
  }

  /* ---------- NOTIFICATIONS PAGE ---------- */
  if(page === "notifications"){
    const user = await requireAuth(["teacher"]);
    if(!user) return;
    _notifications = await fetchNotifications(user.name);
    // notifications.html has its own inline renderLog() — just expose the data
    if(typeof renderLog === "function") renderLog("all");
  }
});
