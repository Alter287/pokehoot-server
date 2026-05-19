const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const { registrar, login, obtenerPerfil, actualizarEstadisticas } = require('./src/usuarios');
const { crearSala, UnirSala, getSala, QuitarJugador } = require('./src/salas');
const { iniciarPartida, manejarRespuesta } = require('./src/logicaJuego');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// ─── RUTAS HTTP ───────────────────────────────────────────────────────────────

// Registro de usuario nuevo
app.post('/registro', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const usuario = await registrar(username, email, password);
    res.json({ success: true, usuario });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// Login
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const resultado = await login(email, password);
    res.json({ success: true, ...resultado });
  } catch (e) {
    res.status(401).json({ success: false, error: e.message });
  }
});

// Obtener perfil y estadísticas
app.get('/perfil/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const perfil = await obtenerPerfil(userId);
    res.json({ success: true, perfil });
  } catch (e) {
    res.status(404).json({ success: false, error: e.message });
  }
});

// ─── SOCKET.IO ────────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);

  // Crear sala
  socket.on('crear_sala', ({ nombreJugador }, callback) => {
    try {
      const sala = crearSala(socket.id, nombreJugador);
      socket.join(sala.code);
      console.log(`Sala creada: ${sala.code} por ${nombreJugador}`);
      callback({ success: true, codigoSala: sala.code });
    } catch (e) {
      callback({ success: false, error: e.message });
    }
  });

  // Unirse a sala
  socket.on('unirse_sala', ({ codigoSala, nombreJugador }, callback) => {
    try {
      const resultado = UnirSala(codigoSala, socket.id, nombreJugador);
      if (!resultado.success) return callback(resultado);

      socket.join(codigoSala);

      // Avisar a todos en la sala de que entró alguien nuevo
      io.to(codigoSala).emit('jugador_unido', {
        jugadores: resultado.room.players
      });

      console.log(`${nombreJugador} se unió a la sala ${codigoSala}`);
      callback({ success: true });
    } catch (e) {
      callback({ success: false, error: e.message });
    }
  });

  // Iniciar partida — solo el host puede hacerlo
  socket.on('iniciar_partida', async ({ codigoSala }) => {
    try {
      const sala = getSala(codigoSala);
      if (!sala) return;
      if (sala.hostId !== socket.id) return; // solo el host
      if (sala.players.length < 2) return;   // mínimo 2 jugadores

      console.log(`Partida iniciada en sala ${codigoSala}`);
      await iniciarPartida(io, codigoSala, sala);

    } catch (e) {
      console.error('Error al iniciar partida:', e.message);
    }
  });

  // Respuesta de un jugador
  socket.on('responder', ({ codigoSala, indiceRespuesta }) => {
    manejarRespuesta(io, codigoSala, socket.id, indiceRespuesta);
  });

  // Actualizar estadísticas al terminar partida
  socket.on('guardar_estadisticas', async ({ userId, gano, correctas, puntos }) => {
    try {
      await actualizarEstadisticas(userId, { gano, correctas, puntos });
    } catch (e) {
      console.error('Error al guardar estadísticas:', e.message);
    }
  });

  // Desconexión
  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
    QuitarJugador(socket.id);
  });
});

// ─── ARRANCAR SERVIDOR ────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});