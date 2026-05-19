const { generarPregunta } = require('./preguntas');
const { getRoom } = require('./salas');

const RONDAS = 10;

async function iniciarPartida(io, codigoSala, sala) {
  sala.state = 'playing';

  for (let i = 0; i < RONDAS; i++) {
    // Generamos la pregunta
    const pregunta = await generarPregunta();
    sala.preguntaActual = pregunta;
    sala.respuestas = {};

    // Enviamos la pregunta a todos los jugadores de la sala
    // Sin la respuesta correcta para que no puedan hacer trampa
    io.to(codigoSala).emit('pregunta', {
      ronda: i + 1,
      totalRondas: RONDAS,
      pregunta: pregunta.pregunta,
      imagenUrl: pregunta.imagenUrl,
      silueta: pregunta.silueta,
      opciones: pregunta.opciones,
      tiempoLimite: pregunta.tiempoLimite
    });

    // Esperamos el tiempo limite de la pregunta
    await esperar(pregunta.tiempoLimite * 1000);

    // Calculamos los resultados de la ronda
    const resultados = calcularResultados(sala, pregunta.respuestaCorrecta);

    // Enviamos los resultados a todos
    io.to(codigoSala).emit('resultado_ronda', {
      respuestaCorrecta: pregunta.respuestaCorrecta,
      opcionCorrecta: pregunta.opciones[pregunta.respuestaCorrecta],
      resultados
    });

    // Pausa de 3 segundos entre rondas para ver los resultados
    await esperar(3000);
  }

  // Fin del juego
  sala.state = 'finished';
  const clasificacion = [...sala.players].sort((a, b) => b.score - a.score);

  io.to(codigoSala).emit('fin_partida', {
    clasificacion
  });
}

function manejarRespuesta(io, codigoSala, idJugador, indiceRespuesta) {
  const sala = getRoom(codigoSala);

  // Comprobaciones de seguridad
  if (!sala) return;
  if (sala.state !== 'playing') return;
  if (sala.answers[idJugador] !== undefined) return; // ya respondió antes

  // Guardamos la respuesta con el momento exacto en que respondió
  sala.answers[idJugador] = {
    indiceRespuesta,
    timestamp: Date.now()
  };
}

function calcularResultados(sala, respuestaCorrecta) {
  return sala.players.map(jugador => {
    const respuesta = sala.answers[jugador.id];
    const correcto = respuesta?.indiceRespuesta === respuestaCorrecta;

    // Calculamos puntos — más puntos si respondió más rápido
    let puntos = 0;
    if (correcto) {
      puntos = 1000;
    }

    if (correcto) jugador.score += puntos;

    return {
      idJugador: jugador.id,
      nombre: jugador.name,
      correcto,
      puntos,
      puntuacionTotal: jugador.score,
      respondio: respuesta !== undefined
    };
  });
}

function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { iniciarPartida, manejarRespuesta };