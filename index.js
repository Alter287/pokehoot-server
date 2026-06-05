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

// Rutas HTTP Para poder conectarse con la API

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

//SOCKET.IO

io.on('connection', (socket) => {
  console.log(`[SOCKET] Conectado: ${socket.id} | Total: ${io.engine.clientsCount}`);

  socket.on('crear_sala', ({ nombreJugador }) => {
    try {
        const sala = crearSala(socket.id, nombreJugador);
        socket.join(sala.codigo);
        socket.emit('sala_creada', { success: true, codigoSala: sala.codigo });
        io.emit('salas_actualizadas'); // ← añade esto, avisa a todos
    } catch (e) {
        socket.emit('sala_creada', { success: false, error: e.message });
    }
});

  socket.on('unirse_sala', ({ codigoSala, nombreJugador }) => {
    try {
        const resultado = unirSala(codigoSala, socket.id, nombreJugador);
        if (!resultado.success) {
            socket.emit('resultado_unirse', resultado);
            return;
        }
        socket.join(codigoSala);
        
        // Avisar a todos los demás de que entró alguien
        io.to(codigoSala).emit('jugador_unido', { jugadores: resultado.sala.jugadores });
        
        // Mandar al nuevo jugador la lista completa
        socket.emit('resultado_unirse', { 
            success: true, 
            jugadores: resultado.sala.jugadores  // ← añade esto
        });
    } catch (e) {
        socket.emit('resultado_unirse', { success: false, error: e.message });
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
      
      const salas = getSalas();
      for (const codigo in salas) {
          const sala = salas[codigo];
          if (sala.idHost === socket.id) {
              io.to(codigo).emit('sala_cerrada', { mensaje: 'El host ha abandonado la sala' });
              break;
          }
      }
      
      quitarJugador(socket.id);
      
      setTimeout(() => {
          io.emit('salas_actualizadas');
      }, 500); // espera 500ms para asegurarse de que la sala ya está borrada
  });
  
  socket.on('salir_sala', ({ codigoSala }) => {
    const sala = getSala(codigoSala);
    if (!sala) return;

    if (sala.idHost === socket.id) {
        io.to(codigoSala).emit('sala_cerrada', { mensaje: 'El host ha abandonado la sala' });
    }

    quitarJugador(socket.id);
    socket.leave(codigoSala);
    io.emit('salas_actualizadas');
});
});

// Inicia servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});