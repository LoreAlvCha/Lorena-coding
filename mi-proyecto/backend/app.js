const express = require("express");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const xss = require("xss");

const app = express();
const SECRET_KEY = process.env.JWT_SECRET || "dev-secret";

app.use(cors());
app.use(bodyParser.json());

// Base de datos SQLite
const db = new sqlite3.Database("./data.db");

// Crear tablas si no existen
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS notas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    titulo TEXT,
    contenido TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES usuarios(id)
  )`);
});

// Middleware para verificar token JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token requerido" });
  }

  const token = authHeader.split(" ")[1];

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: "Token inválido" });
    req.user = user;
    next();
  });
}

// REGISTRO
app.post("/register", (req, res) => {
  // BUG FIX: primero comprobar que existen antes de operar sobre ellos
  const { email: rawEmail, password } = req.body;

  if (!rawEmail || !password) {
    return res.status(400).json({ error: "Email y contraseña requeridos" });
  }

  const email = xss(rawEmail.trim().toLowerCase());

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Email inválido" });
  }

  if (email.length > 100 || password.length > 100) {
    return res.status(400).json({ error: "Datos demasiado largos" });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  const stmt = db.prepare("INSERT INTO usuarios (email, password) VALUES (?, ?)");

  stmt.run(email, hashedPassword, function (err) {
    if (err) {
      if (err.message.includes("UNIQUE constraint")) {
        return res.status(409).json({ error: "Email ya registrado" });
      }
      return res.status(500).json({ error: "Error interno" });
    }
    res.status(201).json({ message: "Usuario creado" });
  });

  stmt.finalize();
});

// LOGIN
app.post("/login", (req, res) => {
  const { email: rawEmail, password } = req.body;

  // BUG FIX: comprobar existencia antes de operar
  if (!rawEmail || !password) {
    return res.status(400).json({ error: "Email y contraseña requeridos" });
  }

  const email = xss(rawEmail.trim().toLowerCase());

  db.get("SELECT * FROM usuarios WHERE email = ?", [email], (err, user) => {
    if (err) return res.status(500).json({ error: "Error interno" });
    if (!user) return res.status(401).json({ error: "Usuario o contraseña incorrectos" });

    if (!bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, SECRET_KEY, { expiresIn: "8h" });
    res.json({ token });
  });
});

// CREAR NOTA
app.post("/notes", authenticateToken, (req, res) => {
  // BUG FIX: todo el flujo va DENTRO del callback del COUNT
  db.get(
    "SELECT COUNT(*) as total FROM notas WHERE user_id = ?",
    [req.user.id],
    (err, row) => {
      if (err) return res.status(500).json({ error: "Error interno" });

      if (row.total >= 100) {
        return res.status(400).json({ error: "Demasiadas notas (máximo 100)" });
      }

      const { titulo: rawTitulo, contenido: rawContenido } = req.body;

      if (!rawTitulo || !rawContenido) {
        return res.status(400).json({ error: "Título y contenido requeridos" });
      }

      if (rawTitulo.length > 100 || rawContenido.length > 1000) {
        return res.status(400).json({ error: "Contenido demasiado largo" });
      }

      const titulo = xss(rawTitulo.trim().slice(0, 100));
      const contenido = xss(rawContenido.trim().slice(0, 1000));

      const stmt = db.prepare(
        "INSERT INTO notas (user_id, titulo, contenido) VALUES (?, ?, ?)"
      );

      stmt.run(req.user.id, titulo, contenido, function (err) {
        if (err) return res.status(500).json({ error: "Error interno" });
        res.status(201).json({ id: this.lastID, titulo, contenido });
      });

      stmt.finalize();
    }
  );
});

// LISTAR NOTAS
app.get("/notes", authenticateToken, (req, res) => {
  db.all(
    "SELECT id, titulo, contenido, created_at, updated_at FROM notas WHERE user_id = ? ORDER BY updated_at DESC",
    [req.user.id],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "Error interno" });
      res.json(rows);
    }
  );
});

// VER NOTA INDIVIDUAL
app.get("/notes/:id", authenticateToken, (req, res) => {
  const noteId = parseInt(req.params.id, 10);
  if (isNaN(noteId) || noteId <= 0) return res.status(400).json({ error: "ID inválido" });

  db.get(
    "SELECT id, titulo, contenido, created_at, updated_at FROM notas WHERE id = ?",
    [noteId],
    (err, row) => {
      if (err) return res.status(500).json({ error: "Error interno" });
      if (!row) return res.status(404).json({ error: "Nota no encontrada" });
      if (row.user_id !== req.user.id) return res.status(403).json({ error: "No autorizado" });
      res.json(row);
    }
  );
});

// EDITAR NOTA
app.put("/notes/:id", authenticateToken, (req, res) => {
  // BUG FIX: validar que el id es un número entero positivo
  const noteId = parseInt(req.params.id, 10);
  if (isNaN(noteId) || noteId <= 0) {
    return res.status(400).json({ error: "ID de nota inválido" });
  }

  const { titulo: rawTitulo, contenido: rawContenido } = req.body;

  if (!rawTitulo || !rawContenido) {
    return res.status(400).json({ error: "Título y contenido requeridos" });
  }

  const titulo = xss(rawTitulo.trim().slice(0, 100));
  const contenido = xss(rawContenido.trim().slice(0, 1000));

  db.get("SELECT user_id FROM notas WHERE id = ?", [noteId], (err, row) => {
    if (err) return res.status(500).json({ error: "Error interno" });
    if (!row) return res.status(404).json({ error: "Nota no encontrada" });
    if (row.user_id !== req.user.id) return res.status(403).json({ error: "No autorizado" });

    const stmt = db.prepare(
      "UPDATE notas SET titulo = ?, contenido = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    );
    stmt.run(titulo, contenido, noteId, function (err) {
      if (err) return res.status(500).json({ error: "Error interno" });
      res.json({ message: "Nota actualizada" });
    });
    stmt.finalize();
  });
});

// BORRAR NOTA
app.delete("/notes/:id", authenticateToken, (req, res) => {
  // BUG FIX: validar que el id es un número entero positivo
  const noteId = parseInt(req.params.id, 10);
  if (isNaN(noteId) || noteId <= 0) {
    return res.status(400).json({ error: "ID de nota inválido" });
  }

  db.get("SELECT user_id FROM notas WHERE id = ?", [noteId], (err, row) => {
    if (err) return res.status(500).json({ error: "Error interno" });
    if (!row) return res.status(404).json({ error: "Nota no encontrada" });
    if (row.user_id !== req.user.id) return res.status(403).json({ error: "No autorizado" });

    const stmt = db.prepare("DELETE FROM notas WHERE id = ?");
    stmt.run(noteId, function (err) {
      if (err) return res.status(500).json({ error: "Error interno" });
      res.json({ message: "Nota borrada" });
    });
    stmt.finalize();
  });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
