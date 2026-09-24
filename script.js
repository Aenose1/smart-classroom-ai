/* =========================================================
   Smart Classroom & AI Timetable Scheduler — script.js
   Vanilla JS. No backend. All state in localStorage.
   ========================================================= */

/* ---------------- Constants ---------------- */

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday"];
const SLOTS = ["09:00 - 10:00","10:00 - 11:00","11:15 - 12:15","01:00 - 02:00","02:00 - 03:00"];
const SUBJECT_POOL = [
  "Machine Learning","Python Programming","Java","Database Systems",
  "Operating Systems","Cloud Computing","Cyber Security","Software Engineering",
  "AI Lab","Data Structures","Computer Networks","Web Development"
];

const KEYS = {
  theme:"sca_theme",
  username:"username",
  rollno:"rollno",
  role:"role",
  students:"sca_students",
  teachers:"sca_teachers",
  classrooms:"sca_classrooms",
  timetable:"sca_timetable",
  notifications:"sca_notifications",
  registeredUsers:"sca_registered_users",
  seeded:"sca_seeded_v2"
};

/* ---------------- Small utils ---------------- */

const $  = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));

function uid(){ return Math.random().toString(36).slice(2,9); }

function getData(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  }catch(e){ return fallback; }
}
function setData(key, val){ localStorage.setItem(key, JSON.stringify(val)); }

function todayName(){
  const d = new Date().getDay(); // 0 Sun ... 6 Sat
  const map = {1:"Monday",2:"Tuesday",3:"Wednesday",4:"Thursday",5:"Friday"};
  return map[d] || "Monday"; // weekend falls back to Monday for demo purposes
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
  const current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem(KEYS.theme, next);
  const btn = $("#themeToggle");
  if(btn) btn.textContent = next === "dark" ? "☀️" : "🌙";
}

/* ---------------- Seed demo data ---------------- */

function seedData(){
  if(localStorage.getItem(KEYS.seeded)) return;

  // Only seed classrooms as physical starter data.
  // Students, teachers, and timetable slots are created by real registrations.
  setData(KEYS.classrooms, [
    { id:uid(), room:"Room 101",    capacity:60,  smartboard:true,  projector:true,  wifi:true, ac:false, status:"Available" },
    { id:uid(), room:"Room 102",    capacity:60,  smartboard:false, projector:true,  wifi:true, ac:true,  status:"Available" },
    { id:uid(), room:"Room 203",    capacity:50,  smartboard:true,  projector:false, wifi:true, ac:false, status:"Available" },
    { id:uid(), room:"Lab A",       capacity:35,  smartboard:true,  projector:true,  wifi:true, ac:true,  status:"Available" },
    { id:uid(), room:"Lab B",       capacity:35,  smartboard:false, projector:true,  wifi:true, ac:true,  status:"Available" },
    { id:uid(), room:"Seminar Hall",capacity:120, smartboard:true,  projector:true,  wifi:true, ac:true,  status:"Available" }
  ]);

  setData(KEYS.students, []);
  setData(KEYS.teachers, []);
  setData(KEYS.timetable, []);
  setData(KEYS.registeredUsers, []);

  localStorage.setItem(KEYS.seeded, "1");
}

/* ---------------- Auth ---------------- */

function getCurrentUser(){
  const name = localStorage.getItem(KEYS.username);
  const role = localStorage.getItem(KEYS.role);
  if(!name || !role) return null;
  return {
    name,
    role,
    rollno: localStorage.getItem(KEYS.rollno) || ""
  };
}

function requireAuth(allowedRoles){
  const user = getCurrentUser();
  if(!user || !allowedRoles.includes(user.role)){
    window.location.href = "login.html";
    return null;
  }
  return user;
}

function logout(){
  localStorage.removeItem(KEYS.username);
  localStorage.removeItem(KEYS.rollno);
  localStorage.removeItem(KEYS.role);
  // Do NOT clear KEYS.seeded or classroom/timetable data — only the session
  window.location.href = "login.html";
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

/* ---------------- Login validation ---------------- */

function markField(fieldEl, invalid, message){
  const errEl = fieldEl.querySelector(".error");
  fieldEl.classList.toggle("invalid", invalid);
  if(errEl && message) errEl.textContent = message;
}

function handleRoleChange(){
  const role = $("#role").value;
  const rollnoField = $("#rollnoField");
  if(rollnoField) rollnoField.style.display = role === "student" ? "block" : "none";
  if(role !== "student" && rollnoField){
    markField(rollnoField, false);
    $("#rollno").value = "";
  }
  $$(".role-pick button").forEach(b => b.classList.toggle("active", b.dataset.role === role));
}

function validateLogin(){
  const roleField = $("#roleField");
  const nameField = $("#nameField");
  const rollnoField = $("#rollnoField");
  const passField = $("#passField");

  const role = $("#role").value;
  const name = $("#name").value.trim();
  const rollno = $("#rollno").value.trim();
  const password = $("#password").value;

  const namePattern = /^[A-Za-z ]+$/;
  let ok = true;

  if(role === ""){
    markField(roleField, true, "Please select a user type.");
    ok = false;
  } else markField(roleField, false);

  if(!namePattern.test(name) || name.length < 2){
    markField(nameField, true, "Name should contain only alphabets and be at least 2 characters.");
    ok = false;
  } else markField(nameField, false);

  if(role === "student"){
    if(rollno === ""){
      markField(rollnoField, true, "Roll number cannot be empty.");
      ok = false;
    } else markField(rollnoField, false);
  }

  if(password.length < 6){
    markField(passField, true, "Password must be at least 6 characters.");
    ok = false;
  } else markField(passField, false);

  if(!ok){
    toast("Please fix the highlighted fields.", "error");
    return false;
  }

  localStorage.setItem(KEYS.username, name);
  localStorage.setItem(KEYS.rollno, role === "student" ? rollno : "");
  localStorage.setItem(KEYS.role, role);

  // Keep admin-facing directories in sync even for users who sign in here
  // instead of going through the Register page.
  const regUsers = getData(KEYS.registeredUsers, []);
  const alreadyExists = regUsers.some(u => u.name === name && u.role === role);
  if(!alreadyExists){
    regUsers.push({ id:uid(), name, role, rollno: role === "student" ? rollno : "" });
    setData(KEYS.registeredUsers, regUsers);

    if(role === "teacher"){
      const teachers = getData(KEYS.teachers, []);
      teachers.push({ id:uid(), name, subject:"—" });
      setData(KEYS.teachers, teachers);
    }
    if(role === "student"){
      const students = getData(KEYS.students, []);
      students.push({ id:uid(), name, roll:rollno, dept:"—", sem:"1", div:"A" });
      setData(KEYS.students, students);
    }
  }

  toast(`Welcome, ${name}!`, "success");
  setTimeout(()=>{
    if(role === "admin") window.location.href = "admin.html";
    else if(role === "teacher") window.location.href = "teacher.html";
    else window.location.href = "student.html";
  }, 500);

  return false;
}

function selectRole(role){
  $("#role").value = role;
  handleRoleChange();
  markField($("#roleField"), false);
}

/* ---------------- Dashboard stats ---------------- */

function renderDashboardStats(){
  const students = getData(KEYS.students, []);
  const teachers = getData(KEYS.teachers, []);
  const classrooms = getData(KEYS.classrooms, []);
  const timetable = getData(KEYS.timetable, []);

  const todayCount = timetable.filter(t => t.day === todayName()).length;

  const setStat = (id, val) => { const el = $(id); if(el) el.textContent = val; };
  setStat("#statStudents", students.length);
  setStat("#statTeachers", teachers.length);
  setStat("#statClassrooms", classrooms.length);
  setStat("#statToday", todayCount);
}

/* ---------------- Admin: Students CRUD ---------------- */

let editingStudentId = null;
let editingTeacherId = null;
let editingRoomId = null;

function renderStudents(){
  const tbody = $("#studentsBody");
  if(!tbody) return;
  const students = getData(KEYS.students, []);
  tbody.innerHTML = students.length ? "" : `<tr class="empty-row"><td colspan="6">No students added yet.</td></tr>`;
  students.forEach(s=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${s.name}</td>
      <td>${s.roll}</td>
      <td>${s.dept}</td>
      <td>${s.sem}</td>
      <td>${s.div}</td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" title="Edit" onclick="editStudent('${s.id}')">✏️</button>
          <button class="icon-btn del" title="Delete" onclick="deleteStudent('${s.id}')">🗑️</button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
}

function saveStudent(){
  const name = $("#studentName").value.trim();
  const roll = $("#studentRoll").value.trim();
  const dept = $("#studentDept").value.trim() || "Information Technology";
  const sem  = $("#studentSem").value;
  const div  = $("#studentDiv").value;

  if(!/^[A-Za-z ]+$/.test(name) || name.length < 2){
    toast("Enter a valid student name (letters only, min 2 characters).", "error");
    return;
  }
  if(roll === ""){
    toast("Roll number is required.", "error");
    return;
  }

  let students = getData(KEYS.students, []);

  if(editingStudentId){
    students = students.map(s => s.id === editingStudentId ? { ...s, name, roll, dept, sem, div } : s);
    toast("Student updated.", "success");
    editingStudentId = null;
    $("#studentSubmitBtn").textContent = "➕ Add Student";
  } else {
    students.push({ id:uid(), name, roll, dept, sem, div });
    toast("Student added.", "success");
  }

  setData(KEYS.students, students);
  clearStudentForm();
  renderStudents();
  renderDashboardStats();
}

function editStudent(id){
  const s = getData(KEYS.students, []).find(x => x.id === id);
  if(!s) return;
  editingStudentId = id;
  $("#studentName").value = s.name;
  $("#studentRoll").value = s.roll;
  $("#studentDept").value = s.dept;
  $("#studentSem").value = s.sem;
  $("#studentDiv").value = s.div;
  $("#studentSubmitBtn").textContent = "💾 Save Changes";
  $("#studentName").scrollIntoView({ behavior:"smooth", block:"center" });
}

function deleteStudent(id){
  if(!confirm("Remove this student record?")) return;
  setData(KEYS.students, getData(KEYS.students, []).filter(s => s.id !== id));
  renderStudents();
  renderDashboardStats();
  toast("Student removed.", "info");
}

function clearStudentForm(){
  ["studentName","studentRoll","studentDept"].forEach(id => { const el = $("#"+id); if(el) el.value = ""; });
  editingStudentId = null;
  if($("#studentSubmitBtn")) $("#studentSubmitBtn").textContent = "➕ Add Student";
}

/* ---------------- Admin: Teachers CRUD ---------------- */

function renderTeachers(){
  const tbody = $("#teachersBody");
  if(!tbody) return;
  const teachers = getData(KEYS.teachers, []);
  tbody.innerHTML = teachers.length ? "" : `<tr class="empty-row"><td colspan="3">No teachers registered yet. Teachers appear here automatically when they sign up.</td></tr>`;
  teachers.forEach(t=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${t.name}</td>
      <td>${t.subject || "—"}</td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" title="Edit" onclick="editTeacher('${t.id}')">✏️</button>
          <button class="icon-btn del" title="Delete" onclick="deleteTeacher('${t.id}')">🗑️</button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
  populateAdminTimetableSelectors();
}

function saveTeacher(){
  const name = $("#teacherName").value.trim();
  const subject = $("#teacherSubject").value.trim();

  if(!/^[A-Za-z .]+$/.test(name) || name.length < 2){
    toast("Enter a valid teacher name.", "error");
    return;
  }
  if(subject === ""){
    toast("Subject is required.", "error");
    return;
  }

  let teachers = getData(KEYS.teachers, []);

  if(editingTeacherId){
    teachers = teachers.map(t => t.id === editingTeacherId ? { ...t, name, subject } : t);
    toast("Teacher updated.", "success");
    editingTeacherId = null;
    $("#teacherSubmitBtn").textContent = "➕ Add Teacher";
  } else {
    teachers.push({ id:uid(), name, subject });
    toast("Teacher added.", "success");
  }

  setData(KEYS.teachers, teachers);
  clearTeacherForm();
  renderTeachers();
  renderDashboardStats();
}

function editTeacher(id){
  const t = getData(KEYS.teachers, []).find(x => x.id === id);
  if(!t) return;
  editingTeacherId = id;
  $("#teacherName").value = t.name;
  $("#teacherSubject").value = t.subject;
  $("#teacherSubmitBtn").textContent = "💾 Save Changes";
  $("#teacherName").scrollIntoView({ behavior:"smooth", block:"center" });
}

function deleteTeacher(id){
  if(!confirm("Remove this teacher record?")) return;
  setData(KEYS.teachers, getData(KEYS.teachers, []).filter(t => t.id !== id));
  renderTeachers();
  renderDashboardStats();
  toast("Teacher removed.", "info");
}

function clearTeacherForm(){
  ["teacherName","teacherSubject"].forEach(id => { const el = $("#"+id); if(el) el.value = ""; });
  editingTeacherId = null;
  if($("#teacherSubmitBtn")) $("#teacherSubmitBtn").textContent = "➕ Add Teacher";
}

/* ---------------- Read-only Classroom Status (Teacher & Student dashboards) ---------------- */

function renderClassroomStatusReadOnly(containerId){
  const wrap = $("#" + containerId);
  if(!wrap) return;
  const rooms = getData(KEYS.classrooms, []);

  wrap.innerHTML = rooms.length ? "" : `<p class="muted">No classrooms have been added yet.</p>`;
  rooms.forEach(r=>{
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

/* ---------------- Admin: Classrooms CRUD ---------------- */

function renderClassrooms(){
  const tbody = $("#classroomsBody");
  const cardsWrap = $("#classroomCards");
  const rooms = getData(KEYS.classrooms, []);

  if(tbody){
    tbody.innerHTML = rooms.length ? "" : `<tr class="empty-row"><td colspan="8">No classrooms added yet.</td></tr>`;
    rooms.forEach(r=>{
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
            <button class="icon-btn" title="Toggle status" onclick="toggleRoomStatus('${r.id}')">🔁</button>
            <button class="icon-btn" title="Edit" onclick="editRoom('${r.id}')">✏️</button>
            <button class="icon-btn del" title="Delete" onclick="deleteRoom('${r.id}')">🗑️</button>
          </div>
        </td>`;
      tbody.appendChild(tr);
    });
  }

  if(cardsWrap){
    cardsWrap.innerHTML = "";
    rooms.forEach(r=>{
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

function badge(bool){
  return `<span class="badge ${bool ? 'on' : 'off'}">${bool ? 'Yes' : 'No'}</span>`;
}

function saveRoom(){
  const room = $("#roomName").value.trim();
  const capacity = parseInt($("#roomCapacity").value, 10) || 0;
  const smartboard = $("#roomSmartboard").checked;
  const projector = $("#roomProjector").checked;
  const wifi = $("#roomWifi").checked;
  const ac = $("#roomAc").checked;
  const status = $("#roomStatus").value;

  if(room === ""){
    toast("Classroom name is required.", "error");
    return;
  }
  if(capacity <= 0){
    toast("Enter a valid capacity.", "error");
    return;
  }

  let rooms = getData(KEYS.classrooms, []);

  if(editingRoomId){
    rooms = rooms.map(r => r.id === editingRoomId ? { ...r, room, capacity, smartboard, projector, wifi, ac, status } : r);
    toast("Classroom updated.", "success");
    editingRoomId = null;
    $("#roomSubmitBtn").textContent = "➕ Add Classroom";
  } else {
    rooms.push({ id:uid(), room, capacity, smartboard, projector, wifi, ac, status });
    toast("Classroom added.", "success");
  }

  setData(KEYS.classrooms, rooms);
  clearRoomForm();
  renderClassrooms();
  renderDashboardStats();
}

function editRoom(id){
  const r = getData(KEYS.classrooms, []).find(x => x.id === id);
  if(!r) return;
  editingRoomId = id;
  $("#roomName").value = r.room;
  $("#roomCapacity").value = r.capacity;
  $("#roomSmartboard").checked = r.smartboard;
  $("#roomProjector").checked = r.projector;
  $("#roomWifi").checked = r.wifi;
  $("#roomAc").checked = r.ac;
  $("#roomStatus").value = r.status;
  $("#roomSubmitBtn").textContent = "💾 Save Changes";
  $("#roomName").scrollIntoView({ behavior:"smooth", block:"center" });
}

function toggleRoomStatus(id){
  const rooms = getData(KEYS.classrooms, []).map(r =>
    r.id === id ? { ...r, status: r.status === "Available" ? "Occupied" : "Available" } : r
  );
  setData(KEYS.classrooms, rooms);
  renderClassrooms();
}

function deleteRoom(id){
  if(!confirm("Remove this classroom?")) return;
  setData(KEYS.classrooms, getData(KEYS.classrooms, []).filter(r => r.id !== id));
  renderClassrooms();
  renderDashboardStats();
  toast("Classroom removed.", "info");
}

function clearRoomForm(){
  $("#roomName").value = "";
  $("#roomCapacity").value = "";
  ["roomSmartboard","roomProjector","roomWifi","roomAc"].forEach(id => { const el = $("#"+id); if(el) el.checked = false; });
  $("#roomStatus").value = "Available";
  editingRoomId = null;
  if($("#roomSubmitBtn")) $("#roomSubmitBtn").textContent = "➕ Add Classroom";
}

/* ---------------- Teacher: lecture scheduling ---------------- */

/* ---------------- Notifications (admin → teacher) ---------------- */

function getAllNotifications(){ return getData(KEYS.notifications, []); }

function pushNotification(teacherName, message){
  const notes = getAllNotifications();
  notes.unshift({ id:uid(), teacher:teacherName, message, ts:Date.now(), read:false });
  setData(KEYS.notifications, notes);
}

function renderTeacherNotifications(){
  const list = $("#notificationsList");
  if(!list) return;
  const user = getCurrentUser();
  const mine = getAllNotifications().filter(n => n.teacher === user.name);
  const unread = mine.filter(n => !n.read).length;

  const badge = $("#unreadBadge");
  if(badge){
    badge.style.display = unread ? "inline-flex" : "none";
    badge.textContent = `${unread} new`;
  }

  list.innerHTML = mine.length ? "" : `<p class="muted">No notifications yet. You'll see a message here if an admin changes one of your lectures.</p>`;
  mine.forEach(n=>{
    const div = document.createElement("div");
    div.className = "notice";
    if(!n.read) div.style.borderLeftColor = "var(--accent-3)";
    const when = new Date(n.ts).toLocaleString();
    div.innerHTML = `${n.read ? "" : "<b>● New —</b> "}${n.message} <div class="muted" style="margin-top:4px;">${when}</div>`;
    list.appendChild(div);
  });
}

function markNotificationsRead(){
  const user = getCurrentUser();
  const notes = getAllNotifications().map(n => n.teacher === user.name ? { ...n, read:true } : n);
  setData(KEYS.notifications, notes);
  renderTeacherNotifications();
  toast("Notifications cleared.", "info");
}

/* ---------------- Timetable: conflict check ---------------- */

function hasConflict(day, time, room, teacherName, excludeId){
  const timetable = getData(KEYS.timetable, []);
  return timetable.some(t =>
    t.id !== excludeId &&
    t.day === day && t.time === time &&
    (t.room === room || t.teacher === teacherName)
  );
}

/* ---------------- Teacher: manual add / edit / delete (own lectures only) ---------------- */

let editingLectureId = null;

function saveLecture(){
  const user = getCurrentUser();
  const subject = $("#subject").value.trim();
  const sem = $("#lecSem").value;
  const div = $("#lecDiv").value;
  const room = $("#room").value;
  const day = $("#lecDay").value;
  const time = $("#time").value;

  if(subject === ""){
    toast("Please enter a subject.", "error");
    return;
  }

  let timetable = getData(KEYS.timetable, []);

  if(editingLectureId){
    const original = timetable.find(t => t.id === editingLectureId);
    if(!original || original.teacher !== user.name){
      toast("You can only edit your own lectures.", "error");
      return;
    }
    if(hasConflict(day, time, room, user.name, editingLectureId)){
      toast(`Clash detected: ${room} or ${user.name} is already booked on ${day} at ${time}.`, "error");
      return;
    }
    timetable = timetable.map(t => t.id === editingLectureId ? { ...t, day, time, subject, room, sem, div } : t);
    toast("Lecture updated.", "success");
    editingLectureId = null;
    $("#lectureSubmitBtn").textContent = "📌 Add to Timetable";
  } else {
    if(hasConflict(day, time, room, user.name)){
      toast(`Clash detected: ${room} or ${user.name} is already booked on ${day} at ${time}.`, "error");
      return;
    }
    timetable.push({ id:uid(), day, time, subject, teacher:user.name, room, sem, div });
    toast("Lecture scheduled successfully!", "success");
  }

  setData(KEYS.timetable, timetable);
  $("#subject").value = "";
  renderTeacherLectures();
}

function editLecture(id){
  const user = getCurrentUser();
  const lecture = getData(KEYS.timetable, []).find(t => t.id === id);
  if(!lecture || lecture.teacher !== user.name){
    toast("You can only edit your own lectures.", "error");
    return;
  }
  editingLectureId = id;
  $("#subject").value = lecture.subject;
  $("#lecSem").value = lecture.sem;
  $("#lecDiv").value = lecture.div;
  $("#room").value = lecture.room;
  $("#lecDay").value = lecture.day;
  $("#time").value = lecture.time;
  $("#lectureSubmitBtn").textContent = "💾 Save Changes";
  $("#subject").scrollIntoView({ behavior:"smooth", block:"center" });
}

function deleteLecture(id){
  const user = getCurrentUser();
  const lecture = getData(KEYS.timetable, []).find(t => t.id === id);
  if(!lecture || lecture.teacher !== user.name){
    toast("You can only delete your own lectures.", "error");
    return;
  }
  if(!confirm("Remove this lecture from the timetable?")) return;
  setData(KEYS.timetable, getData(KEYS.timetable, []).filter(t => t.id !== id));
  if(editingLectureId === id){ editingLectureId = null; $("#lectureSubmitBtn").textContent = "📌 Add to Timetable"; }
  renderTeacherLectures();
  toast("Lecture removed.", "info");
}

function renderTeacherLectures(){
  const tbody = $("#lectureBody");
  if(!tbody) return;
  const user = getCurrentUser();
  const rows = getData(KEYS.timetable, []).filter(t => t.teacher === user.name);

  tbody.innerHTML = rows.length ? "" : `<tr class="empty-row"><td colspan="7">No lectures scheduled yet. Add one above, or generate a full week automatically.</td></tr>`;
  rows.forEach(t=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${t.day}</td>
      <td>${t.time}</td>
      <td>${t.subject}</td>
      <td>${t.room}</td>
      <td>Sem ${t.sem}</td>
      <td>${t.div}</td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" title="Edit" onclick="editLecture('${t.id}')">✏️</button>
          <button class="icon-btn del" title="Delete" onclick="deleteLecture('${t.id}')">🗑️</button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
}

/* ---------------- Admin: manage the FULL timetable (any teacher, any slot) ---------------- */

let editingAdminLectureId = null;

function populateAdminTimetableSelectors(){
  const teacherSel = $("#ttTeacher");
  const roomSel = $("#ttRoom");
  if(!teacherSel || !roomSel) return;

  // Show any teacher we know about: registered through the registration page,
  // added manually to the directory, OR already appearing in the timetable
  // (e.g. a teacher who signed in via Login and generated their own schedule).
  const regUsers = getData(KEYS.registeredUsers, []);
  const registeredNames = regUsers.filter(u => u.role === "teacher").map(u => u.name);
  const directoryNames = getData(KEYS.teachers, []).map(t => t.name);
  const timetableNames = getData(KEYS.timetable, []).map(t => t.teacher);

  const teacherNames = Array.from(new Set([...registeredNames, ...directoryNames, ...timetableNames]))
    .filter(Boolean);

  const rooms = getData(KEYS.classrooms, []);

  teacherSel.innerHTML = teacherNames.length
    ? teacherNames.map(n => `<option value="${n}">${n}</option>`).join("")
    : `<option value="">No teachers registered yet</option>`;

  roomSel.innerHTML = rooms.length
    ? rooms.map(r => `<option value="${r.room}">${r.room}</option>`).join("")
    : `<option value="">Add a classroom first</option>`;
}

function adminSaveLecture(){
  const subject = $("#ttSubject").value.trim();
  const teacher = $("#ttTeacher").value;
  const room = $("#ttRoom").value;
  const day = $("#ttDay").value;
  const time = $("#ttTime").value;
  const sem = $("#ttSem").value;

  if(subject === ""){
    toast("Please enter a subject.", "error");
    return;
  }
  if(teacher === ""){
    toast("Add at least one teacher before scheduling a lecture.", "error");
    return;
  }

  let timetable = getData(KEYS.timetable, []);

  if(editingAdminLectureId){
    const original = timetable.find(t => t.id === editingAdminLectureId);
    if(hasConflict(day, time, room, teacher, editingAdminLectureId)){
      toast(`Clash detected: ${room} or ${teacher} is already booked on ${day} at ${time}.`, "error");
      return;
    }
    timetable = timetable.map(t => t.id === editingAdminLectureId ? { ...t, day, time, subject, teacher, room, sem } : t);
    setData(KEYS.timetable, timetable);

    if(original){
      pushNotification(original.teacher,
        `An admin updated your ${original.subject} lecture (was ${original.day}, ${original.time}). It's now "${subject}" on ${day} at ${time} in ${room}.`);
      if(teacher !== original.teacher){
        pushNotification(teacher, `An admin assigned you a new lecture: ${subject} on ${day} at ${time} in ${room}.`);
      }
    }
    toast("Lecture updated and teacher notified.", "success");
    editingAdminLectureId = null;
    $("#ttSubmitBtn").textContent = "➕ Add Lecture";
  } else {
    if(hasConflict(day, time, room, teacher)){
      toast(`Clash detected: ${room} or ${teacher} is already booked on ${day} at ${time}.`, "error");
      return;
    }
    timetable.push({ id:uid(), day, time, subject, teacher, room, sem, div:"A" });
    setData(KEYS.timetable, timetable);
    pushNotification(teacher, `An admin scheduled a new lecture for you: ${subject} on ${day} at ${time} in ${room}.`);
    toast("Lecture added and teacher notified.", "success");
  }

  $("#ttSubject").value = "";
  renderAdminTimetable();
  renderDashboardStats();
}

function adminEditLecture(id){
  const t = getData(KEYS.timetable, []).find(x => x.id === id);
  if(!t) return;
  editingAdminLectureId = id;
  $("#ttSubject").value = t.subject;
  $("#ttTeacher").value = t.teacher;
  $("#ttRoom").value = t.room;
  $("#ttDay").value = t.day;
  $("#ttTime").value = t.time;
  $("#ttSem").value = t.sem;
  $("#ttSubmitBtn").textContent = "💾 Save Changes";
  $("#ttSubject").scrollIntoView({ behavior:"smooth", block:"center" });
}

function adminDeleteLecture(id){
  const t = getData(KEYS.timetable, []).find(x => x.id === id);
  if(!t) return;
  if(!confirm(`Remove ${t.subject} (${t.day}, ${t.time}) from ${t.teacher}'s timetable?`)) return;

  setData(KEYS.timetable, getData(KEYS.timetable, []).filter(x => x.id !== id));
  pushNotification(t.teacher, `An admin removed your ${t.subject} lecture on ${t.day} at ${t.time}.`);

  if(editingAdminLectureId === id){ editingAdminLectureId = null; $("#ttSubmitBtn").textContent = "➕ Add Lecture"; }
  renderAdminTimetable();
  renderDashboardStats();
  toast("Lecture removed and teacher notified.", "info");
}

function renderAdminTimetable(){
  const tbody = $("#adminTimetableBody");
  if(!tbody) return;
  const rows = getData(KEYS.timetable, []).slice().sort((a,b)=>
    DAYS.indexOf(a.day)-DAYS.indexOf(b.day) || SLOTS.indexOf(a.time)-SLOTS.indexOf(b.time)
  );

  tbody.innerHTML = rows.length ? "" : `<tr class="empty-row"><td colspan="7">No lectures scheduled yet.</td></tr>`;
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
          <button class="icon-btn" title="Edit" onclick="adminEditLecture('${t.id}')">✏️</button>
          <button class="icon-btn del" title="Delete" onclick="adminDeleteLecture('${t.id}')">🗑️</button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
}

/* ---------------- AI Timetable Generator (conflict-free) ---------------- */

function generateAITimetable(scopeTeacherOnly){
  const user = getCurrentUser();
  const teachers = getData(KEYS.teachers, []);
  const rooms = getData(KEYS.classrooms, []).map(r => r.room);
  let timetable = getData(KEYS.timetable, []);

  if(!rooms.length){
    toast("Add at least one classroom before generating a timetable.", "error");
    return;
  }

  const teacherName = user && user.role === "teacher" ? user.name : null;

  // If generating for a single teacher, remove their old slots first.
  if(scopeTeacherOnly && teacherName){
    timetable = timetable.filter(t => t.teacher !== teacherName);
    editingLectureId = null;
    if($("#lectureSubmitBtn")) $("#lectureSubmitBtn").textContent = "📌 Add to Timetable";
  }

  DAYS.forEach(day=>{
    SLOTS.forEach(time=>{
      const bookedRooms = new Set(timetable.filter(t => t.day===day && t.time===time).map(t=>t.room));
      const bookedTeachers = new Set(timetable.filter(t => t.day===day && t.time===time).map(t=>t.teacher));

      const availableRooms = rooms.filter(r => !bookedRooms.has(r));
      if(!availableRooms.length) return; // fully booked slot, skip (no clash created)

      const room = availableRooms[Math.floor(Math.random()*availableRooms.length)];
      const subject = SUBJECT_POOL[Math.floor(Math.random()*SUBJECT_POOL.length)];

      let teacher = teacherName;
      if(!teacher){
        const availableTeachers = teachers.map(t=>t.name).filter(n => !bookedTeachers.has(n));
        teacher = availableTeachers.length
          ? availableTeachers[Math.floor(Math.random()*availableTeachers.length)]
          : (teachers[0] ? teachers[0].name : "Staff");
        if(bookedTeachers.has(teacher)) return; // avoid double-booking as a last resort
      }

      timetable.push({ id:uid(), day, time, subject, teacher, room, sem:"5", div:"A" });
    });
  });

  setData(KEYS.timetable, timetable);
  toast("✅ AI Timetable generated — conflicts avoided automatically!", "success");

  // A full-college regeneration (admin, not scoped to one teacher) touches everyone's
  // schedule — notify each teacher once rather than spamming a message per slot.
  if(!scopeTeacherOnly && user && user.role === "admin"){
    teachers.forEach(t => pushNotification(t.name, "An admin regenerated the full-college AI timetable. Please check your schedule for changes."));
  }

  renderTeacherLectures();
  renderTeacherNotifications();
  renderFullTimetable();
  renderStudentTimetable();
  renderMiniTimetable(true);
  renderAdminTimetable();
}

/* ---------------- Full timetable view (timetable.html) ---------------- */

function renderFullTimetable(filter){
  const grid = $("#fullTimetableGrid");
  if(!grid) return;

  const timetable = getData(KEYS.timetable, []);
  const query = (filter || "").trim().toLowerCase();

  let html = `<div class="tt-cell head">Time</div>`;
  DAYS.forEach(d => html += `<div class="tt-cell head">${d}</div>`);

  SLOTS.forEach(time=>{
    html += `<div class="tt-cell time">${time}</div>`;
    DAYS.forEach(day=>{
      const entry = timetable.find(t => t.day === day && t.time === time);
      if(!entry){
        html += `<div class="tt-cell slot empty">Free</div>`;
        return;
      }
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
  const q = $("#ttSearch").value;
  renderFullTimetable(q);
}

/* ---------------- Student dashboard ---------------- */

function renderStudentTimetable(){
  const tbody = $("#studentTodayBody");
  if(!tbody) return;
  const day = todayName();
  const rows = getData(KEYS.timetable, []).filter(t => t.day === day).sort((a,b)=> SLOTS.indexOf(a.time)-SLOTS.indexOf(b.time));

  $("#todayLabel") && ($("#todayLabel").textContent = day);

  tbody.innerHTML = rows.length ? "" : `<tr class="empty-row"><td colspan="3">No lectures scheduled for today.</td></tr>`;
  rows.forEach(t=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${t.time}</td><td>${t.subject}</td><td>${t.room}</td>`;
    tbody.appendChild(tr);
  });
}

function searchStudentTimetable(){
  const q = $("#studentSearch").value.trim().toLowerCase();
  const tbody = $("#studentSearchBody");
  if(!tbody) return;
  const rows = getData(KEYS.timetable, []).filter(t =>
    t.subject.toLowerCase().includes(q) || t.day.toLowerCase().includes(q)
  );
  tbody.innerHTML = rows.length ? "" : `<tr class="empty-row"><td colspan="5">No matching classes found.</td></tr>`;
  rows.forEach(t=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${t.day}</td><td>${t.time}</td><td>${t.subject}</td><td>${t.teacher}</td><td>${t.room}</td>`;
    tbody.appendChild(tr);
  });
}

/* ---------------- Hero mini timetable animation ---------------- */

function renderMiniTimetable(regenerate){
  const grid = $("#miniGrid");
  if(!grid) return;

  const shortDays = ["MON","TUE","WED","THU","FRI"];
  let html = `<div class="cell head">TIME</div>`;
  shortDays.forEach(d => html += `<div class="cell head">${d}</div>`);

  const rowsCount = 4;
  for(let r=0;r<rowsCount;r++){
    html += `<div class="cell">P${r+1}</div>`;
    for(let c=0;c<5;c++){
      html += `<div class="cell" data-r="${r}" data-c="${c}">·</div>`;
    }
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

/* ---------------- Nav active state ---------------- */

function markActiveNav(){
  const page = document.body.dataset.page;
  $$(".nav-links a").forEach(a=>{
    if(a.dataset.nav === page) a.classList.add("active");
  });
}

/* ---------------- Registration validation ---------------- */

function regHandleRoleChange(){
  const role = $("#regRole").value;
  const rollnoField = $("#regRollnoField");
  if(rollnoField) rollnoField.style.display = role === "student" ? "block" : "none";
  if(role !== "student" && rollnoField){
    markField(rollnoField, false);
    $("#regRollno").value = "";
  }
  $$(".role-pick button").forEach(b => b.classList.toggle("active", b.dataset.role === role));
}

function regSelectRole(role){
  $("#regRole").value = role;
  regHandleRoleChange();
  markField($("#regRoleField"), false);
}

function validateRegistration(){
  const roleField = $("#regRoleField");
  const fnameField = $("#fnameField");
  const lnameField = $("#lnameField");
  const rollnoField = $("#regRollnoField");
  const passField = $("#regPassField");
  const emailField = $("#regEmailField");
  const mobileField = $("#mobileField");
  const addressField = $("#addressField");

  const role = $("#regRole").value;
  const fname = $("#fname").value.trim();
  const lname = $("#lname").value.trim();
  const rollno = $("#regRollno").value.trim();
  const password = $("#regPassword").value;
  const email = $("#regEmail").value.trim();
  const mobile = $("#mobile").value.trim();
  const address = $("#address").value.trim();

  const namePattern = /^[A-Za-z]+$/;
  const emailPattern = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  const mobilePattern = /^[0-9]{10}$/;

  let ok = true;

  // User Type: required
  if(role === ""){
    markField(roleField, true);
    ok = false;
  } else markField(roleField, false);

  // First Name: alphabets only, minimum 2 characters
  if(!namePattern.test(fname) || fname.length < 2){
    markField(fnameField, true);
    ok = false;
  } else markField(fnameField, false);

  // Last Name: required
  if(lname === ""){
    markField(lnameField, true);
    ok = false;
  } else markField(lnameField, false);

  // Roll Number: required for students only
  if(role === "student"){
    if(rollno === ""){
      markField(rollnoField, true);
      ok = false;
    } else markField(rollnoField, false);
  }

  // Password: minimum 6 characters
  if(password.length < 6){
    markField(passField, true);
    ok = false;
  } else markField(passField, false);

  // Email: standard name@domain.com format
  if(!emailPattern.test(email)){
    markField(emailField, true);
    ok = false;
  } else markField(emailField, false);

  // Mobile Number: exactly 10 digits
  if(!mobilePattern.test(mobile)){
    markField(mobileField, true);
    ok = false;
  } else markField(mobileField, false);

  // Address: required
  if(address === ""){
    markField(addressField, true);
    ok = false;
  } else markField(addressField, false);

  if(!ok){
    toast("Please fix the highlighted fields.", "error");
    return false;
  }

  // Registration succeeded — save this user into the shared registry.
  const fullName = `${fname} ${lname}`;
  const regUsers = getData(KEYS.registeredUsers, []);
  // Avoid duplicate entries for same name+role
  const alreadyExists = regUsers.some(u => u.name === fullName && u.role === role);
  if(!alreadyExists){
    regUsers.push({ id:uid(), name:fullName, role, rollno: role === "student" ? rollno : "" });
    setData(KEYS.registeredUsers, regUsers);

    // Auto-add to the appropriate directory so Admin can see them immediately
    if(role === "teacher"){
      const teachers = getData(KEYS.teachers, []);
      teachers.push({ id:uid(), name:fullName, subject:"—", email:"—" });
      setData(KEYS.teachers, teachers);
    }
    if(role === "student"){
      const students = getData(KEYS.students, []);
      students.push({ id:uid(), name:fullName, roll:rollno, dept:"—", sem:"1", div:"A" });
      setData(KEYS.students, students);
    }
  }

  // Sign the new account in and send them to their dashboard.
  localStorage.setItem(KEYS.username, fullName);
  localStorage.setItem(KEYS.rollno, role === "student" ? rollno : "");
  localStorage.setItem(KEYS.role, role);

  toast("🎉 Registration Successful!", "success");
  $("#registrationForm").reset();

  setTimeout(()=>{
    if(role === "admin") window.location.href = "admin.html";
    else if(role === "teacher") window.location.href = "teacher.html";
    else window.location.href = "student.html";
  }, 700);

  return false;
}

/* ---------------- Init dispatcher ---------------- */

document.addEventListener("DOMContentLoaded", () => {
  seedData();
  initTheme();
  markActiveNav();
  renderUserChip();

  const themeBtn = $("#themeToggle");
  if(themeBtn) themeBtn.addEventListener("click", toggleTheme);

  const page = document.body.dataset.page;

  if(page === "home"){
    renderMiniTimetable();

    const user = getCurrentUser();
    const bell = $("#notifBell");
    const dot = $("#notifDot");
    const dashBtn = $("#dashboardBtn");

    if(user){
      // Show dashboard shortcut for any logged-in user
      if(dashBtn){
        dashBtn.style.display = "inline-flex";
        const href = user.role === "admin" ? "admin.html"
                   : user.role === "teacher" ? "teacher.html"
                   : "student.html";
        dashBtn.setAttribute("href", href);
      }

      // Show notification bell only for teachers (they receive timetable change alerts)
      if(bell && user.role === "teacher"){
        bell.style.display = "inline-flex";
        const unread = getAllNotifications().filter(n => n.teacher === user.name && !n.read).length;
        if(dot) dot.style.display = unread > 0 ? "block" : "none";
      }
    }
  }

  if(page === "login"){
    // If already logged in, go straight to the right dashboard
    const existing = getCurrentUser();
    if(existing){
      if(existing.role === "admin") window.location.href = "admin.html";
      else if(existing.role === "teacher") window.location.href = "teacher.html";
      else window.location.href = "student.html";
    }
  }

  if(page === "register"){
    // nothing extra needed — form handles itself
  }

  if(page === "admin"){
    const user = requireAuth(["admin"]);
    if(user){
      $("#adminNameDisplay") && ($("#adminNameDisplay").textContent = user.name);
    }
    renderDashboardStats();
    renderStudents();
    renderTeachers();
    renderClassrooms();
    renderAdminTimetable();
  }

  if(page === "teacher"){
    const user = requireAuth(["teacher"]);
    if(user){
      $("#teacherNameDisplay") && ($("#teacherNameDisplay").textContent = user.name);
      $("#profileName") && ($("#profileName").textContent = user.name);
      renderTeacherLectures();
      renderTeacherNotifications();
      renderClassroomStatusReadOnly("teacherClassroomStatus");
    }
  }

  if(page === "student"){
    const user = requireAuth(["student"]);
    if(user){
      $("#studentNameDisplay") && ($("#studentNameDisplay").textContent = user.name);
      $("#profileName") && ($("#profileName").textContent = user.name);
      $("#profileRoll") && ($("#profileRoll").textContent = user.rollno || "—");
    }
    renderStudentTimetable();
    searchStudentTimetable();
    renderClassroomStatusReadOnly("studentClassroomStatus");
  }

  if(page === "timetable"){
    const user = getCurrentUser();
    const btn = $("#regenerateBtn");
    if(btn && user && user.role === "admin"){
      btn.style.display = "inline-flex";
      $("#editHint") && ($("#editHint").textContent = "You're signed in as admin — regenerating rebuilds everyone's schedule and notifies every teacher.");
    }
    renderFullTimetable();
  }
});
