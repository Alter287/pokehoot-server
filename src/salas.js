const salas = {};

function generarCodigoSala() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function crearSala(idHost, nombreJugador) {
  const codigo = generarCodigoSala();
  salas[codigo] = {
    codigo,
    idHost,
    jugadores: [{ id: idHost, nombre: nombreJugador, puntuacion: 0 }],
    estado: 'esperando',
    preguntaActual: null,
    respuestas: {}
  };
  return salas[codigo];
}

function unirSala(codigo, idJugador, nombreJugador) {
  const sala = salas[codigo];
  if (!sala) return { success: false, error: 'Sala no encontrada' };
  if (sala.estado !== 'esperando') return { success: false, error: 'Partida en curso' };
  if (sala.jugadores.length >= 8) return { success: false, error: 'Sala llena' };

  sala.jugadores.push({ id: idJugador, nombre: nombreJugador, puntuacion: 0 });
  return { success: true, sala };
}

function getSala(codigo) {
  return salas[codigo];
}

function quitarJugador(idJugador) {
  for (const codigo in salas) {
    const sala = salas[codigo];
    sala.jugadores = sala.jugadores.filter(j => j.id !== idJugador);
    if (sala.jugadores.length === 0) {
      delete salas[codigo];
    }
  }
}

function getSalas() {
  return salas;
}

module.exports = { crearSala, unirSala, getSala, quitarJugador, getSalas };