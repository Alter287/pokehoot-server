const { generarPregunta } = require('./preguntas');
const { getSala } = require('./salas');

const RONDAS = 10;

async function iniciarPartida(io, codigoSala, sala) {
  sala.estado = 'jugando';

  //Lo hace 10 veces porque esa es la variable rondas
  for (let i = 0; i < RONDAS; i++) {
    let pregunta;
    try {
      console.log(`[RONDA] Generando pregunta ronda ${i + 1}`);
      pregunta = await generarPregunta();
    } catch (e) {
      console.error(`[RONDA] Error generando pregunta ronda ${i + 1}: ${e.message}`);
      i--;
      continue;
    }

    sala.preguntaActual = pregunta;
    sala.respuestas = {};

    console.log(`[RONDA] Emitiendo pregunta ronda ${i + 1}`);
    io.to(codigoSala).emit('pregunta', {
      ronda: i + 1,
      totalRondas: RONDAS,
      pregunta: pregunta.pregunta,
      imagenUrl: pregunta.imagenUrl,
      silueta: pregunta.silueta,
      opciones: pregunta.opciones,
      tiempoLimite: pregunta.tiempoLimite,
      tipo: pregunta.tipo
    });

    await esperar(pregunta.tiempoLimite * 1000);
    console.log(`[RONDA] Tiempo agotado ronda ${i + 1}`);

    const resultados = calcularResultados(sala, pregunta.respuestaCorrecta);

    io.to(codigoSala).emit('resultado_ronda', {
      respuestaCorrecta: pregunta.respuestaCorrecta,
      opcionCorrecta: pregunta.opciones[pregunta.respuestaCorrecta],
      resultados
    });

    await esperar(3000);
    console.log(`[RONDA] Fin espera ronda ${i + 1}`);
  }

  sala.estado = 'finalizada';
  const clasificacion = [...sala.jugadores].sort((a, b) => b.puntuacion - a.puntuacion);
  io.to(codigoSala).emit('fin_partida', { clasificacion });
}

function manejarRespuesta(io, codigoSala, idJugador, indiceRespuesta) {
  const sala = getSala(codigoSala);

  if (!sala) return;
  if (sala.estado !== 'jugando') return;
  if (sala.respuestas[idJugador] !== undefined) return;

  sala.respuestas[idJugador] = {
    indiceRespuesta,
    momento: Date.now()
  };
}

function calcularResultados(sala, respuestaCorrecta) {
  return sala.jugadores.map(jugador => {
    const respuesta = sala.respuestas[jugador.id];
    const correcto = respuesta?.indiceRespuesta === respuestaCorrecta;

    let puntos = 0;
    if (correcto) {
      puntos = 1000;
      jugador.puntuacion += puntos;
    }

    return {
      idJugador: jugador.id,
      nombre: jugador.nombre,
      correcto,
      puntos,
      puntuacionTotal: jugador.puntuacion,
      respondio: respuesta !== undefined
    };
  });
}

function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { iniciarPartida, manejarRespuesta };