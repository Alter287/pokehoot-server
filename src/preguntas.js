const axios = require('axios');

const TOTAL_POKEMON = 1025;

const TIPOS = [
  'fuego', 'agua', 'planta', 'electrico', 'psiquico', 'fantasma',
  'dragon', 'siniestro', 'acero', 'hada', 'lucha', 'roca',
  'tierra', 'volador', 'veneno', 'bicho', 'hielo', 'normal'
];

async function obtenerPokemonAleatorio() {
  const id = Math.floor(Math.random() * TOTAL_POKEMON) + 1;
  const res = await axios.get(`https://pokeapi.co/api/v2/pokemon/${id}`);
  return res.data;
}

async function generarPregunta() {
  const tiposPregunta = ['nombre', 'tipo', 'numero'];
  const tipoPregunta = tiposPregunta[Math.floor(Math.random() * tiposPregunta.length)];
  const pokemon = await obtenerPokemonAleatorio();

  if (tipoPregunta === 'nombre') {
    // Obtenemos 3 pokemon falsos para las opciones incorrectas
    const falsos = await Promise.all([
      obtenerPokemonAleatorio(),
      obtenerPokemonAleatorio(),
      obtenerPokemonAleatorio()
    ]);

    const opciones = mezclar([pokemon.name, ...falsos.map(p => p.name)]);

    return {
      tipo: 'nombre',
      pregunta: '¿Quién es este Pokémon?',
      imagenUrl: pokemon.sprites.other['official-artwork'].front_default,
      silueta: true,
      opciones,
      respuestaCorrecta: opciones.indexOf(pokemon.name),
      tiempoLimite: 15
    };
  }

  if (tipoPregunta === 'tipo') {
    const tiposCorrecto = pokemon.types.map(t => t.type.name);
    const tipoCorrecto = tiposCorrecto[0];
    const tiposFalsos = mezclar(TIPOS.filter(t => !tiposCorrecto.includes(t))).slice(0, 3);
    const opciones = mezclar([tipoCorrecto, ...tiposFalsos]);

    return {
      tipo: 'tipo',
      pregunta: `¿De qué tipo es ${pokemon.name}?`,
      imagenUrl: pokemon.sprites.other['official-artwork'].front_default,
      silueta: false,
      opciones,
      respuestaCorrecta: opciones.indexOf(tipoCorrecto),
      tiempoLimite: 12
    };
  }

// Cambiar los numeros para que sean un math random de entre 120+ o 120- numeros
  if (tipoPregunta === 'numero') {
    const correcto = pokemon.id;
    const falsos = mezclar([
      correcto + 1,
      correcto - 1,
      correcto + 50,
      correcto - 50,
      correcto + 100
    ].filter(n => n > 0 && n <= TOTAL_POKEMON)).slice(0, 3);

    const opciones = mezclar([correcto, ...falsos]).map(String);

    return {
      tipo: 'numero',
      pregunta: `¿Cuál es el número de la Pokédex de ${pokemon.name}?`,
      imagenUrl: pokemon.sprites.other['official-artwork'].front_default,
      silueta: false,
      opciones,
      respuestaCorrecta: opciones.indexOf(String(correcto)),
      tiempoLimite: 12
    };
  }
}

function mezclar(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

module.exports = { generarPregunta };