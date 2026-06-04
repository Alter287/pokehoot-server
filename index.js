const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const { registrar, login, obtenerPerfil, actualizarEstadisticas } = require('./src/usuarios');
const { crearSala, unirSala, getSala, quitarJugador, getSalas } = require('./src/salas');
const { iniciarPartida, manejarRespuesta } = require('./src/logicaJuego');
const { iniciarSolitario, manejarRespuestaSolitario, abandonarSolitario } = require('./src/logicaJuegoSolitario');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*',allowEIO3: true,
    transports: ['polling', 'websocket'] } });

// ─── RUTAS HTTP ───────────────────────────────────────────────────────────────

app.post('/registro', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const usuario = await registrar(username, email, password);
    res.json({ success: true, usuario });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const resultado = await login(email, password);
    res.json({ success: true, ...resultado });
  } catch (e) {
    res.status(401).json({ success: false, error: e.message });
  }
});

app.get('/perfil/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const perfil = await obtenerPerfil(userId);
    res.json({ success: true, perfil });
  } catch (e) {
    res.status(404).json({ success: false, error: e.message });
  }
});

app.get('/salas', (req, res) => {
  const salas = getSalas();
  const salasActivas = Object.values(salas)
    .filter(sala => sala.estado === 'esperando')
    .map(sala => ({
      codigo: sala.codigo,
      jugadoresActuales: sala.jugadores.length,
      jugadoresMaximos: 8
    }));
  res.json({ success: true, salas: salasActivas });
});

// ─── SOCKET.IO ────────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[SOCKET] Conectado: ${socket.id} | Total: ${io.engine.clientsCount}`);

  socket.on('crear_sala', ({ nombreJugador }, callback) => {
    try {
      const sala = crearSala(socket.id, nombreJugador);
      socket.join(sala.codigo);
      console.log(`[SALA] Creada: ${sala.codigo} | Host: ${nombreJugador}`);
      callback({ success: true, codigoSala: sala.codigo });
    } catch (e) {
      console.error(`[SALA] Error al crear: ${e.message}`);
      callback({ success: false, error: e.message });
    }
  });

  socket.on('unirse_sala', ({ codigoSala, nombreJugador }, callback) => {
    try {
      console.log(`[SALA] ${nombreJugador} intentando unirse a ${codigoSala}`);
      const resultado = unirSala(codigoSala, socket.id, nombreJugador);
      if (!resultado.success) {
        console.log(`[SALA] Error al unirse: ${resultado.error}`);
        return callback(resultado);
      }
      socket.join(codigoSala);
      console.log(`[SALA] ${nombreJugador} unido a ${codigoSala} | Jugadores: ${resultado.sala.jugadores.length}`);
      io.to(codigoSala).emit('jugador_unido', { jugadores: resultado.sala.jugadores });
      callback({ success: true });
    } catch (e) {
      console.error(`[SALA] Error al unirse: ${e.message}`);
      callback({ success: false, error: e.message });
    }
  });

  socket.on('iniciar_partida', async ({ codigoSala }) => {
    try {
      console.log(`[PARTIDA] Solicitud de inicio en sala ${codigoSala} por ${socket.id}`);
      const sala = getSala(codigoSala);
      if (!sala) { console.log(`[PARTIDA] Sala no encontrada`); return; }
      if (sala.idHost !== socket.id) { console.log(`[PARTIDA] No es el host`); return; }
      if (sala.jugadores.length < 2) { console.log(`[PARTIDA] Pocos jugadores: ${sala.jugadores.length}`); return; }
      console.log(`[PARTIDA] Iniciando con ${sala.jugadores.length} jugadores`);
      await iniciarPartida(io, codigoSala, sala);
    } catch (e) {
      console.error(`[PARTIDA] Error: ${e.message}`);
    }
  });

  socket.on('responder', ({ codigoSala, indiceRespuesta }) => {
    manejarRespuesta(io, codigoSala, socket.id, indiceRespuesta);
  });

  socket.on('guardar_estadisticas', async ({ userId, gano, correctas, puntos }) => {
    try {
      await actualizarEstadisticas(userId, { gano, correctas, puntos });
    } catch (e) {
      console.error(`[STATS] Error: ${e.message}`);
    }
  });

  socket.on('solitario:iniciar', ({ userId }) => iniciarSolitario(io, socket, userId));
  socket.on('solitario:responder', ({ indiceRespuesta }) => manejarRespuestaSolitario(io, socket, indiceRespuesta));
  socket.on('solitario:abandonar', () => abandonarSolitario(socket));

  socket.on('disconnect', () => {
    console.log(`[SOCKET] Desconectado: ${socket.id} | Total: ${io.engine.clientsCount}`);
    quitarJugador(socket.id);
  });
});

// ─── ARRANCAR SERVIDOR ────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});