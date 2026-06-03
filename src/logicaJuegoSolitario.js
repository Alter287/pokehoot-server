const { generarPregunta } = require('./preguntas');
const { actualizarEstadisticas } = require('./usuarios');

// Mapa de partidas solitarias activas: socketId → estado
const partidasSolitarias = {};

/**
 * Inicia una partida solitaria para un jugador.
 * Se llama cuando el cliente emite 'solitario:iniciar'.
 */
async function iniciarSolitario(io, socket, userId) {
  // Si ya tiene una partida activa la limpiamos
  if (partidasSolitarias[socket.id]) {
    limpiarPartida(socket.id);
  }

  partidasSolitarias[socket.id] = {
    userId: userId || null,   // null si no está autenticado
    ronda: 0,
    puntuacion: 0,
    racha: 0,                 // preguntas correctas seguidas (para bonus)
    activa: true,
    timeoutId: null
  };

  socket.emit('solitario:iniciado', { mensaje: '¡Buena suerte!' });

  await enviarSiguientePregunta(io, socket);
}

/**
 * Genera y envía la siguiente pregunta al jugador.
 */
async function enviarSiguientePregunta(io, socket) {
  const partida = partidasSolitarias[socket.id];
  if (!partida || !partida.activa) return;

  partida.ronda += 1;

  let pregunta;
  try {
    pregunta = await generarPregunta();
  } catch (err) {
    socket.emit('solitario:error', { mensaje: 'Error generando pregunta, intenta de nuevo.' });
    return;
  }

  // Guardamos la pregunta en el estado para validar la respuesta después
  partida.preguntaActual = pregunta;
  partida.respondio = false;

  socket.emit('solitario:pregunta', {
    ronda:       partida.ronda,
    puntuacion:  partida.puntuacion,
    racha:       partida.racha,
    pregunta:    pregunta.pregunta,
    imagenUrl:   pregunta.imagenUrl,
    silueta:     pregunta.silueta,
    opciones:    pregunta.opciones,
    tiempoLimite: pregunta.tiempoLimite,
    tipo:        pregunta.tipo
  });

  // Temporizador: si no responde a tiempo, cuenta como fallo
  partida.timeoutId = setTimeout(() => {
    manejarTimeout(io, socket);
  }, pregunta.tiempoLimite * 1000);
}

/**
 * Procesa la respuesta del jugador.
 * Se llama cuando el cliente emite 'solitario:responder'.
 */
async function manejarRespuestaSolitario(io, socket, indiceRespuesta) {
  const partida = partidasSolitarias[socket.id];
  if (!partida || !partida.activa) return;
  if (partida.respondio) return; // evita doble envío

  partida.respondio = true;

  // Cancelamos el temporizador porque respondió a tiempo
  clearTimeout(partida.timeoutId);

  const pregunta = partida.preguntaActual;
  const correcto = indiceRespuesta === pregunta.respuestaCorrecta;

  if (correcto) {
    // Calculamos puntos con bonus de racha
    partida.racha += 1;
    const bonusRacha = Math.floor(partida.racha / 3) * 100; // +100 cada 3 correctas seguidas
    const puntos = 1000 + bonusRacha;
    partida.puntuacion += puntos;

    socket.emit('solitario:resultado', {
      correcto:        true,
      indiceRespuesta,
      respuestaCorrecta: pregunta.respuestaCorrecta,
      opcionCorrecta:  pregunta.opciones[pregunta.respuestaCorrecta],
      puntos,
      bonusRacha,
      puntuacion:      partida.puntuacion,
      racha:           partida.racha,
    });

    // Pequeña pausa para que el jugador vea el resultado y continuamos
    await esperar(2500);
    await enviarSiguientePregunta(io, socket);

  } else {
    // Fallo → fin de partida
    await finalizarSolitario(socket, partida, {
      correcto:        false,
      indiceRespuesta,
      respuestaCorrecta: pregunta.respuestaCorrecta,
      opcionCorrecta:  pregunta.opciones[pregunta.respuestaCorrecta],
      motivo:          'respuesta_incorrecta'
    });
  }
}

/**
 * Se dispara cuando el jugador no responde a tiempo.
 */
async function manejarTimeout(io, socket) {
  const partida = partidasSolitarias[socket.id];
  if (!partida || !partida.activa || partida.respondio) return;

  partida.respondio = true;

  const pregunta = partida.preguntaActual;

  await finalizarSolitario(socket, partida, {
    correcto:        false,
    indiceRespuesta: null,
    respuestaCorrecta: pregunta.respuestaCorrecta,
    opcionCorrecta:  pregunta.opciones[pregunta.respuestaCorrecta],
    motivo:          'tiempo_agotado'
  });
}

/**
 * Finaliza la partida, guarda estadísticas y emite el evento de fin.
 */
async function finalizarSolitario(socket, partida, infoFallo) {
  partida.activa = false;
  clearTimeout(partida.timeoutId);

  // Guardamos estadísticas si el jugador estaba autenticado
  if (partida.userId) {
    try {
      await actualizarEstadisticas(partida.userId, {
        gano:       false,           // en solitario nunca se "gana", solo se supera racha
        correctas:  partida.ronda - 1, // la última fue fallo
        puntos:     partida.puntuacion
      });
    } catch (err) {
      console.error('Error guardando estadísticas solitario:', err);
    }
  }

  socket.emit('solitario:fin', {
    ...infoFallo,
    rondas:     partida.ronda,
    puntuacion: partida.puntuacion,
    racha:      partida.racha,
  });

  limpiarPartida(socket.id);
}

/**
 * Abandono voluntario: el jugador cierra o pulsa "Salir".
 * Se llama cuando el cliente emite 'solitario:abandonar' o en 'disconnect'.
 */
async function abandonarSolitario(socket) {
  const partida = partidasSolitarias[socket.id];
  if (!partida || !partida.activa) return;

  clearTimeout(partida.timeoutId);
  partida.activa = false;

  // Guardamos igualmente las estadísticas parciales
  if (partida.userId) {
    try {
      await actualizarEstadisticas(partida.userId, {
        gano:      false,
        correctas: partida.ronda > 0 ? partida.ronda - 1 : 0,
        puntos:    partida.puntuacion
      });
    } catch (err) {
      console.error('Error guardando estadísticas al abandonar:', err);
    }
  }

  limpiarPartida(socket.id);
}

function limpiarPartida(socketId) {
  delete partidasSolitarias[socketId];
}

function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { iniciarSolitario, manejarRespuestaSolitario, abandonarSolitario };