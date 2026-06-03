const sala = {};

function generarCodigoSala() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function crearSala(idHost, nombreJugador) {
  const codigo = generarCodigoSala();
  sala[codigo] = {
    codigo: codigo,
    idHost: idHost,
    jugadores: [{ id: idHost, nombre: nombreJugador, puntuacion: 0 }],
    estado: 'esperando',
    preguntaActual: null,
    respuestas: {}
  };
  return sala[codigo];
}

function UnirSala(codigo, playerId, playerName) {
  const room = sala[codigo];
  if (!room) return { success: false, error: 'Sala no encontrada' };
  if (room.state !== 'waiting') return { success: false, error: 'Partida en curso' };
  if (room.players.length >= 8) return { success: false, error: 'Sala llena' };

  room.players.push({ id: playerId, name: playerName, score: 0 });
  return { success: true, room };
}

function getSala(codigo) {
  return sala[codigo];
}

function QuitarJugador(idJugador) {
  for (const codigo in sala) {
    const room = sala[codigo];
    room.players = room.players.filter(p => p.id !== idJugador);
    if (room.players.length === 0) {
      delete sala[codigo];
    }
  }
}

function getRooms() {
    return sala;
}

module.exports = { crearSala, UnirSala, getSala, QuitarJugador, getRooms };