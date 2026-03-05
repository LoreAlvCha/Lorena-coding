// ─── ESTADO INTERNO ───────────────────────────────────────────
let editingNoteId = null;

// ─── NAVEGACIÓN ───────────────────────────────────────────────
function showRegister() {
  document.getElementById("login").classList.add("hidden");
  document.getElementById("register").classList.remove("hidden");
}
function showLogin() {
  document.getElementById("register").classList.add("hidden");
  document.getElementById("login").classList.remove("hidden");
}
function showNotes() {
  document.getElementById("login").classList.add("hidden");
  document.getElementById("register").classList.add("hidden");
  document.getElementById("notes").classList.remove("hidden");
}

// ─── AUTH HELPERS ─────────────────────────────────────────────
function getToken() { return localStorage.getItem("token"); }
function saveToken(t) { localStorage.setItem("token", t); }
function clearToken() { localStorage.removeItem("token"); }
function authHeaders() {
  return {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + getToken()
  };
}

// ─── REGISTRO ─────────────────────────────────────────────────
async function register() {
  const email    = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPassword").value;
  const password2 = document.getElementById("regPassword2").value;

  if (password !== password2) { alert("Las contraseñas no coinciden"); return; }
  if (!email || !password) { alert("Por favor rellena todos los campos"); return; }

  const res  = await fetch("http://localhost:3000/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (res.ok) { alert("Cuenta creada. Ya puedes iniciar sesión."); showLogin(); }
  else { alert("Error: " + data.error); }
}

// ─── LOGIN ────────────────────────────────────────────────────
async function login() {
  const email    = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  if (!email || !password) { alert("Por favor rellena todos los campos"); return; }

  const res  = await fetch("http://localhost:3000/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (res.ok) { saveToken(data.token); showNotes(); loadNotes(); }
  else { alert("Error: " + data.error); }
}

// ─── LOGOUT ───────────────────────────────────────────────────
function logout() {
  clearToken();
  document.getElementById("notes").classList.add("hidden");
  document.getElementById("notesContainer").innerHTML = "";
  showLogin();
}

// ─── CARGAR NOTAS ─────────────────────────────────────────────
const ACCENTS = ["#f05a1a","#e8832a","#c4953a","#5aab7a","#4a8fc0","#8a5ab8","#c06a7a"];

async function loadNotes() {
  const res = await fetch("http://localhost:3000/notes", { headers: authHeaders() });

  if (res.status === 401 || res.status === 403) {
    alert("Sesión expirada. Por favor inicia sesión de nuevo.");
    logout(); return;
  }

  const notes     = await res.json();
  const container = document.getElementById("notesContainer");
  const countEl   = document.getElementById("notesCount");

  container.innerHTML = "";
  countEl.textContent = notes.length + (notes.length === 1 ? " nota" : " notas");

  if (notes.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `
      <div class="empty-icon-wrap">
        <span class="empty-icon">📝</span>
      </div>
      <strong>Sin notas aún</strong>
      <p>Todavía no tienes notas.<br>¡Crea la primera con el botón de arriba!</p>
    `;
    container.appendChild(empty);
    return;
  }

  notes.forEach((n, i) => {
    const card = document.createElement("div");
    card.className = "note-card";
    card.style.animationDelay = (i * 0.07) + "s";

    // Barra de color superior
    const accent = document.createElement("div");
    accent.className = "note-card-accent";
    accent.style.background = ACCENTS[i % ACCENTS.length];

    // Cuerpo de la card
    const body = document.createElement("div");
    body.className = "note-card-body";

    const number = document.createElement("span");
    number.className = "note-number";
    number.textContent = "NOTA #" + String(i + 1).padStart(2, "0");

    const title = document.createElement("h4");
    title.textContent = n.titulo;

    const content = document.createElement("p");
    content.textContent = n.contenido;

    body.appendChild(number);
    body.appendChild(title);
    body.appendChild(content);

    // Footer
    const footer = document.createElement("div");
    footer.className = "note-card-footer";

    const date = document.createElement("span");
    date.className = "note-date";
    date.textContent = new Date(n.updated_at).toLocaleDateString("es-ES", {
      day: "2-digit", month: "short", year: "numeric"
    });

    const actions = document.createElement("div");
    actions.className = "note-actions";

    const btnEdit = document.createElement("button");
    btnEdit.className = "btn btn-edit";
    btnEdit.textContent = "✏️ Editar";
    btnEdit.onclick = () => openEditModal(n.id, n.titulo, n.contenido);

    const btnDelete = document.createElement("button");
    btnDelete.className = "btn btn-danger";
    btnDelete.textContent = "🗑️";
    btnDelete.onclick = () => deleteNote(n.id);

    actions.appendChild(btnEdit);
    actions.appendChild(btnDelete);
    footer.appendChild(date);
    footer.appendChild(actions);

    card.appendChild(accent);

    // Patrón decorativo asimétrico (lado derecho)
    const pattern = document.createElement("div");
    pattern.className = "note-card-pattern";
    const c = ACCENTS[i % ACCENTS.length];
    const patternVariants = [
      `<svg viewBox="0 0 96 180" xmlns="http://www.w3.org/2000/svg">
        <polygon points="72,18 76,30 89,30 79,38 83,51 72,43 61,51 65,38 55,30 68,30" fill="${c}" opacity="0.18" transform="rotate(12,72,34)"/>
        <polygon points="18,72 20,79 27,79 21,83 23,90 18,86 13,90 15,83 9,79 16,79" fill="${c}" opacity="0.11" transform="rotate(-18,18,81)"/>
        <polygon points="80,105 82,111 88,111 83,115 85,121 80,117 75,121 77,115 71,111 78,111" fill="${c}" opacity="0.1"/>
        <circle cx="38" cy="145" r="18" fill="none" stroke="${c}" stroke-width="1.2" opacity="0.09"/>
        <polygon points="55,158 56,161 60,161 57,163 58,166 55,164 52,166 53,163 50,161 54,161" fill="${c}" opacity="0.14"/>
        <line x1="12" y1="50" x2="12" y2="92" stroke="${c}" stroke-width="1" opacity="0.07" stroke-dasharray="3,4"/>
      </svg>`,
      `<svg viewBox="0 0 96 180" xmlns="http://www.w3.org/2000/svg">
        <polygon points="84,12 87,22 97,22 89,28 92,38 84,32 76,38 79,28 71,22 81,22" fill="${c}" opacity="0.15"/>
        <polygon points="58,58 61,67 70,67 63,73 66,82 58,76 50,82 53,73 46,67 55,67" fill="${c}" opacity="0.1" transform="rotate(-10,58,70)"/>
        <polygon points="78,112 80,118 86,118 81,122 83,128 78,124 73,128 75,122 70,118 76,118" fill="${c}" opacity="0.12" transform="rotate(20,78,120)"/>
        <path d="M 28 145 Q 62 122 82 158" fill="none" stroke="${c}" stroke-width="1.2" opacity="0.08"/>
        <circle cx="22" cy="82" r="7" fill="${c}" opacity="0.06"/>
        <circle cx="86" cy="168" r="4" fill="${c}" opacity="0.1"/>
      </svg>`,
      `<svg viewBox="0 0 96 180" xmlns="http://www.w3.org/2000/svg">
        <polygon points="50,8 53,18 63,18 55,24 58,34 50,28 42,34 45,24 37,18 47,18" fill="${c}" opacity="0.19" transform="rotate(5,50,21)"/>
        <rect x="69" y="56" width="15" height="15" rx="3" fill="${c}" opacity="0.08" transform="rotate(28,76,63)"/>
        <polygon points="82,98 84,104 90,104 85,108 87,114 82,110 77,114 79,108 74,104 80,104" fill="${c}" opacity="0.11"/>
        <line x1="18" y1="32" x2="40" y2="84" stroke="${c}" stroke-width="1" opacity="0.07" stroke-dasharray="4,5"/>
        <circle cx="28" cy="133" r="22" fill="none" stroke="${c}" stroke-width="1" opacity="0.07"/>
        <polygon points="64,158 65,161 69,161 66,163 67,166 64,164 61,166 62,163 59,161 63,161" fill="${c}" opacity="0.14"/>
      </svg>`,
      `<svg viewBox="0 0 96 180" xmlns="http://www.w3.org/2000/svg">
        <polygon points="28,18 31,28 41,28 33,34 36,44 28,38 20,44 23,34 15,28 25,28" fill="${c}" opacity="0.16" transform="rotate(-8,28,31)"/>
        <polygon points="78,58 80,64 86,64 81,68 83,74 78,70 73,74 75,68 70,64 76,64" fill="${c}" opacity="0.12"/>
        <line x1="28" y1="28" x2="78" y2="61" stroke="${c}" stroke-width="0.9" opacity="0.06"/>
        <polygon points="54,92 56,98 62,98 57,102 59,108 54,104 49,108 51,102 46,98 52,98" fill="${c}" opacity="0.1" transform="rotate(10,54,100)"/>
        <line x1="78" y1="61" x2="54" y2="95" stroke="${c}" stroke-width="0.9" opacity="0.06"/>
        <circle cx="74" cy="142" r="16" fill="none" stroke="${c}" stroke-width="1.2" opacity="0.08" stroke-dasharray="3,5"/>
        <polygon points="19,157 20,160 24,160 21,162 22,165 19,163 16,165 17,162 14,160 18,160" fill="${c}" opacity="0.13"/>
      </svg>`,
    ];
    pattern.innerHTML = patternVariants[i % patternVariants.length];
    card.appendChild(pattern);

    card.appendChild(body);
    card.appendChild(footer);
    container.appendChild(card);
  });
}

// ─── MODAL ────────────────────────────────────────────────────
function openCreateModal() {
  editingNoteId = null;
  document.getElementById("modalTitle").textContent = "Nueva nota";
  document.getElementById("modalSaveBtn").textContent = "Guardar nota";
  document.getElementById("modalTitulo").value = "";
  document.getElementById("modalContenido").value = "";
  document.getElementById("counterTitulo").textContent = "0 / 100";
  document.getElementById("counterContenido").textContent = "0 / 1000";
  document.getElementById("noteModal").classList.remove("hidden");
  document.getElementById("modalTitulo").focus();
}

function openEditModal(id, titulo, contenido) {
  editingNoteId = id;
  document.getElementById("modalTitle").textContent = "Editar nota";
  document.getElementById("modalSaveBtn").textContent = "Guardar cambios";
  document.getElementById("modalTitulo").value = titulo;
  document.getElementById("modalContenido").value = contenido;
  document.getElementById("counterTitulo").textContent = titulo.length + " / 100";
  document.getElementById("counterContenido").textContent = contenido.length + " / 1000";
  document.getElementById("noteModal").classList.remove("hidden");
  document.getElementById("modalTitulo").focus();
}

function closeModal() {
  document.getElementById("noteModal").classList.add("hidden");
  editingNoteId = null;
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("noteModal").addEventListener("click", function(e) {
    if (e.target === this) closeModal();
  });
  document.getElementById("modalTitulo").addEventListener("input", function() {
    const el = document.getElementById("counterTitulo");
    el.textContent = this.value.length + " / 100";
    el.classList.toggle("warn", this.value.length > 80);
  });
  document.getElementById("modalContenido").addEventListener("input", function() {
    const el = document.getElementById("counterContenido");
    el.textContent = this.value.length + " / 1000";
    el.classList.toggle("warn", this.value.length > 800);
  });
});

// ─── GUARDAR NOTA ─────────────────────────────────────────────
async function saveNote() {
  const titulo    = document.getElementById("modalTitulo").value.trim();
  const contenido = document.getElementById("modalContenido").value.trim();

  if (!titulo || !contenido) { alert("El título y el contenido no pueden estar vacíos."); return; }

  let res;
  if (editingNoteId === null) {
    res = await fetch("http://localhost:3000/notes", {
      method: "POST", headers: authHeaders(),
      body: JSON.stringify({ titulo, contenido })
    });
  } else {
    res = await fetch("http://localhost:3000/notes/" + editingNoteId, {
      method: "PUT", headers: authHeaders(),
      body: JSON.stringify({ titulo, contenido })
    });
  }
  const data = await res.json();
  if (res.ok) { closeModal(); loadNotes(); }
  else { alert("Error: " + data.error); }
}

// ─── BORRAR NOTA ──────────────────────────────────────────────
async function deleteNote(id) {
  if (!confirm("¿Seguro que quieres borrar esta nota? Esta acción no se puede deshacer.")) return;
  const res  = await fetch("http://localhost:3000/notes/" + id, {
    method: "DELETE", headers: authHeaders()
  });
  const data = await res.json();
  if (res.ok) { loadNotes(); }
  else { alert("Error: " + data.error); }
}