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