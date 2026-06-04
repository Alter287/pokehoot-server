const axios = require('axios');

const TOTAL_POKEMON = 1025;

const TIPO_TRADUCCION = {
  normal: 'normal', fire: 'fuego', water: 'agua', electric: 'electrico',
  grass: 'planta', ice: 'hielo', fighting: 'lucha', poison: 'veneno',
  ground: 'tierra', flying: 'volador', psychic: 'psiquico', bug: 'bicho',
  rock: 'roca', ghost: 'fantasma', dragon: 'dragon', dark: 'siniestro',
  steel: 'acero', fairy: 'hada',
};

// ─── Pesos de aparición por tipo de pregunta ─────────────────────────────────
// Total = 100. género <-> evolución intercambiados respecto a la versión anterior.
const TIPOS_PREGUNTA_PESOS = [
  { tipo: 'nombre',     peso: 30 }, // ¿Quién es este Pokémon? (silueta)
  { tipo: 'tipo',       peso: 18 }, // ¿De qué tipo es?
  { tipo: 'generacion', peso: 15 }, // ¿De qué generación es?
  { tipo: 'habilidad',  peso: 15 }, // ¿Cuál es una habilidad de X?
  { tipo: 'evolucion',  peso: 12 }, // ¿Cómo evoluciona? (todos los triggers)
  { tipo: 'genero',     peso:  5 }, // ¿Es hembra o macho? (solo si hay diferencia visual)
  { tipo: 'numero',     peso:  5 }, // ¿Cuál es su número en la Pokédex?
];
 
// ─── Rangos de IDs por generación ────────────────────────────────────────────
const GENERACIONES = [
  { gen: 1, nombre: 'Generación I',   min: 1,   max: 151  },
  { gen: 2, nombre: 'Generación II',  min: 152,  max: 251  },
  { gen: 3, nombre: 'Generación III', min: 252,  max: 386  },
  { gen: 4, nombre: 'Generación IV',  min: 387,  max: 493  },
  { gen: 5, nombre: 'Generación V',   min: 494,  max: 649  },
  { gen: 6, nombre: 'Generación VI',  min: 650,  max: 721  },
  { gen: 7, nombre: 'Generación VII', min: 722,  max: 809  },
  { gen: 8, nombre: 'Generación VIII',min: 810,  max: 898  },
];
 
function obtenerGeneracion(id) {
  return GENERACIONES.find(g => id >= g.min && id <= g.max) || GENERACIONES[0];
}
 
// ─── Utilidades ───────────────────────────────────────────────────────────────
function mezclar(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}
 
/** Elige un tipo de pregunta respetando los pesos definidos. */
function elegirTipoPregunta() {
  const total = TIPOS_PREGUNTA_PESOS.reduce((s, t) => s + t.peso, 0);
  let r = Math.random() * total;
  for (const { tipo, peso } of TIPOS_PREGUNTA_PESOS) {
    r -= peso;
    if (r <= 0) return tipo;
  }
  return TIPOS_PREGUNTA_PESOS[0].tipo;
}
 
// ─── Fetchers ─────────────────────────────────────────────────────────────────
async function obtenerPokemonAleatorio() {
  const id = Math.floor(Math.random() * TOTAL_POKEMON) + 1;
  const res = await axios.get(`https://pokeapi.co/api/v2/pokemon/${id}`);
  return res.data;
}
 
async function obtenerEspeciePokemon(id) {
  const res = await axios.get(`https://pokeapi.co/api/v2/pokemon-species/${id}`);
  return res.data;
}
 
/** Devuelve todos los nombres de habilidades de la PokeAPI (para opciones falsas). */
let _todasHabilidades = null;
async function obtenerTodasHabilidades() {
  if (_todasHabilidades) return _todasHabilidades;
  const res = await axios.get('https://pokeapi.co/api/v2/ability?limit=400');
  _todasHabilidades = res.data.results.map(h => h.name);
  return _todasHabilidades;
}
 
// ─── Generadores de pregunta ──────────────────────────────────────────────────
 
/** NOMBRE — silueta negra, ¿quién es este Pokémon? */
async function preguntaNombre(pokemon) {
  const falsos = await Promise.all([
    obtenerPokemonAleatorio(),
    obtenerPokemonAleatorio(),
    obtenerPokemonAleatorio(),
  ]);
  const opciones = mezclar([pokemon.name, ...falsos.map(p => p.name)]);
  return {
    tipo: 'nombre',
    pregunta: '¿Quién es este Pokémon?',
    imagenUrl: pokemon.sprites.other['official-artwork'].front_default,
    silueta: true,
    opciones,
    respuestaCorrecta: opciones.indexOf(pokemon.name),
    tiempoLimite: 15,
  };
}
 
/** TIPO — imagen normal, ¿de qué tipo es? */
async function preguntaTipo(pokemon) {
  const tiposCorrecto = pokemon.types.map(t => TIPO_TRADUCCION[t.type.name] || t.type.name);
  const tipoCorrecto = tiposCorrecto[0];
  const tiposFalsos = mezclar(TIPOS.filter(t => !tiposCorrecto.includes(t))).slice(0, 3);
  const opciones = mezclar([tipoCorrecto, ...tiposFalsos]);
  return {
    tipo: 'tipo',
    pregunta: `¿De qué tipo principal es ${pokemon.name}?`,
    imagenUrl: pokemon.sprites.other['official-artwork'].front_default,
    silueta: false,
    opciones,
    respuestaCorrecta: opciones.indexOf(tipoCorrecto),
    tiempoLimite: 12,
  };
}
 
/** NÚMERO — imagen normal, ¿cuál es su número en la Pokédex? */
async function preguntaNumero(pokemon) {
  const correcto = pokemon.id;
  const candidatos = [
    correcto + 1, correcto - 1,
    correcto + 50, correcto - 50,
    correcto + 100,
  ].filter(n => n > 0 && n <= TOTAL_POKEMON && n !== correcto);
  const falsos = mezclar(candidatos).slice(0, 3);
  const opciones = mezclar([correcto, ...falsos]).map(String);
  return {
    tipo: 'numero',
    pregunta: `¿Cuál es el número en la Pokédex de ${pokemon.name}?`,
    imagenUrl: pokemon.sprites.other['official-artwork'].front_default,
    silueta: false,
    opciones,
    respuestaCorrecta: opciones.indexOf(String(correcto)),
    tiempoLimite: 10,
  };
}
 
/** GENERACIÓN — silueta, ¿de qué generación es? */
async function preguntaGeneracion(pokemon) {
  const genCorrecta = obtenerGeneracion(pokemon.id);
  const gensFalsas = mezclar(
    GENERACIONES.filter(g => g.gen !== genCorrecta.gen)
  ).slice(0, 3);
  const opciones = mezclar([genCorrecta.nombre, ...gensFalsas.map(g => g.nombre)]);
  return {
    tipo: 'generacion',
    pregunta: `¿De qué generación es ${pokemon.name}?`,
    imagenUrl: pokemon.sprites.other['official-artwork'].front_default,
    silueta: true,
    opciones,
    respuestaCorrecta: opciones.indexOf(genCorrecta.nombre),
    tiempoLimite: 12,
  };
}
 
/** HABILIDAD — imagen normal, ¿cuál de estas es una habilidad de X? */
async function preguntaHabilidad(pokemon) {
  const habilidadesPropias = pokemon.abilities.map(a => a.ability.name);
  // Elegimos UNA habilidad correcta al azar de las que tiene el pokemon
  const habilidadCorrecta = habilidadesPropias[Math.floor(Math.random() * habilidadesPropias.length)];
 
  const todasHabilidades = await obtenerTodasHabilidades();
  // Falsas: cualquier habilidad que NO tenga el pokemon
  const falsas = mezclar(
    todasHabilidades.filter(h => !habilidadesPropias.includes(h))
  ).slice(0, 3);
 
  const opciones = mezclar([habilidadCorrecta, ...falsas]);
  return {
    tipo: 'habilidad',
    pregunta: `¿Cuál de estas es una habilidad de ${pokemon.name}?`,
    imagenUrl: pokemon.sprites.other['official-artwork'].front_default,
    silueta: false,
    opciones,
    respuestaCorrecta: opciones.indexOf(habilidadCorrecta),
    tiempoLimite: 13,
  };
}
 
/**
 * GÉNERO — solo se genera si el Pokémon tiene sprite diferente de hembra.
 * Muestra UNO de los dos sprites y pregunta si es hembra o macho.
 * Devuelve null si el Pokémon no tiene diferencia visual de género.
 */
async function preguntaGenero(pokemon) {
  const spriteHembra = pokemon.sprites.front_female;
  const spriteMacho  = pokemon.sprites.front_default;
 
  if (!spriteHembra) return null; // sin diferencia → descartamos
 
  const esMacho = Math.random() < 0.5;
  const imagenUrl = esMacho ? spriteMacho : spriteHembra;
  const respuesta  = esMacho ? 'Macho ♂' : 'Hembra ♀';
  const opciones   = mezclar(['Macho ♂', 'Hembra ♀']);
 
  return {
    tipo: 'genero',
    pregunta: `¿Este ${pokemon.name} es macho o hembra?`,
    imagenUrl,
    silueta: false,
    opciones,
    respuestaCorrecta: opciones.indexOf(respuesta),
    tiempoLimite: 8,
  };
}
 
// ─── Mapa de triggers → texto legible ────────────────────────────────────────
// Cubre todos los métodos de evolución conocidos en la PokeAPI.
const TRIGGER_TEXTO = {
  // Nivel
  'level-up':                    (d) => d.min_level ? `Nivel ${d.min_level}` : null,
  // Intercambios
  'trade':                       (d) => d.held_item
                                          ? `Intercambio con ${d.held_item.name}`
                                          : 'Intercambio',
  // Uso de objetos (piedras y similares)
  'use-item':                    (d) => d.item ? `Usar ${d.item.name}` : 'Usar objeto',
  // Otros triggers específicos
  'shed':                        ()  => 'Desprendimiento (nivel 20 + hueco)',
  'spin':                        ()  => 'Dar vueltas',
  'tower-of-darkness':           ()  => 'Torre de la Oscuridad',
  'tower-of-waters':             ()  => 'Torre del Agua',
  'three-critical-hits':         ()  => 'Tres golpes críticos en combate',
  'take-damage':                 ()  => 'Recibir daño y caminar',
  'other':                       ()  => null,
  'agile-style-move':            (d) => d.known_move ? `Usar ${d.known_move.name} (estilo ágil)` : null,
  'strong-style-move':           (d) => d.known_move ? `Usar ${d.known_move.name} (estilo fuerte)` : null,
  'recoil-damage':               ()  => 'Recibir daño de retroceso',
};
 
// Condiciones adicionales que se añaden al texto base (level-up principalmente)
function condicionExtra(d) {
  if (d.held_item)         return ` con ${d.held_item.name}`;
  if (d.item)              return ` con ${d.item.name}`;
  if (d.known_move)        return ` sabiendo ${d.known_move.name}`;
  if (d.known_move_type)   return ` sabiendo mov. ${d.known_move_type.name}`;
  if (d.location)          return ` en ${d.location.name}`;
  if (d.time_of_day)       return ` (${d.time_of_day})`;
  if (d.min_happiness)     return ` (felicidad ≥ ${d.min_happiness})`;
  if (d.min_affection)     return ` (afecto ≥ ${d.min_affection})`;
  if (d.min_beauty)        return ` (belleza ≥ ${d.min_beauty})`;
  if (d.needs_overworld_rain) return ' (lluvia)';
  if (d.turn_upside_down)  return ' (boca abajo)';
  if (d.gender === 1)      return ' (hembra)';
  if (d.gender === 2)      return ' (macho)';
  if (d.relative_physical_stats === 1)  return ' (Ataque > Defensa)';
  if (d.relative_physical_stats === -1) return ' (Defensa > Ataque)';
  if (d.relative_physical_stats === 0)  return ' (Ataque = Defensa)';
  return '';
}
 
/** Convierte un objeto evolution_detail en texto legible, o null si no se puede. */
function detalleATexto(d) {
  const triggerName = d.trigger?.name;
  const fn = TRIGGER_TEXTO[triggerName];
  if (!fn) return null;
 
  // Para level-up sin nivel mínimo, añadimos condición extra
  if (triggerName === 'level-up' && !d.min_level) {
    const extra = condicionExtra(d);
    if (!extra) return null; // sin info útil
    return `Subir nivel${extra}`;
  }
 
  const base = fn(d);
  if (!base) return null;
 
  // Para level-up con nivel, condición extra opcional
  if (triggerName === 'level-up') {
    return base + condicionExtra(d);
  }
  return base;
}
 
// Pool fijo de métodos de evolución falsos (usados cuando no hay suficientes reales)
const METODOS_FALSOS_POOL = [
  'Nivel 16', 'Nivel 20', 'Nivel 28', 'Nivel 32', 'Nivel 36', 'Nivel 40',
  'Intercambio', 'Intercambio con metal-coat', 'Intercambio con dragon-scale',
  'Intercambio con king-s-rock', 'Intercambio con upgrade',
  'Usar fire-stone', 'Usar water-stone', 'Usar thunder-stone',
  'Usar leaf-stone', 'Usar moon-stone', 'Usar sun-stone',
  'Usar ice-stone', 'Usar shiny-stone', 'Usar dusk-stone', 'Usar dawn-stone',
  'Subir nivel (felicidad ≥ 160)', 'Subir nivel (noche)',
  'Subir nivel (día)', 'Subir nivel (lluvia)',
  'Subir nivel sabiendo surf', 'Subir nivel sabiendo rollout',
  'Dar vueltas', 'Tres golpes críticos en combate',
];
 
/**
 * EVOLUCIÓN — cubre level-up, trade, use-item y condiciones especiales.
 * Devuelve null si el Pokémon no tiene ninguna evolución con texto legible.
 */
async function preguntaEvolucion(pokemon) {
  let especie;
  try {
    especie = await obtenerEspeciePokemon(pokemon.id);
  } catch {
    return null;
  }
 
  const cadenaUrl = especie.evolution_chain?.url;
  if (!cadenaUrl) return null;
 
  const cadenaRes = await axios.get(cadenaUrl);
  const cadena = cadenaRes.data.chain;
 
  // Recorremos toda la cadena buscando el nodo del pokemon actual
  function buscarDetalles(nodo, nombreBuscado) {
    for (const evo of nodo.evolves_to) {
      if (evo.species.name === nombreBuscado) {
        return evo.evolution_details; // array de posibles métodos
      }
      const resultado = buscarDetalles(evo, nombreBuscado);
      if (resultado) return resultado;
    }
    return null;
  }
 
  const detalles = buscarDetalles(cadena, pokemon.name);
  if (!detalles || detalles.length === 0) return null;
 
  // Convertimos todos los detalles a texto y filtramos los nulos
  const textosCorrecto = detalles
    .map(detalleATexto)
    .filter(Boolean);
 
  if (textosCorrecto.length === 0) return null;
 
  // Elegimos uno al azar si hay varios métodos posibles (ej. Wurmple)
  const respuestaCor = textosCorrecto[Math.floor(Math.random() * textosCorrecto.length)];
 
  // Opciones falsas: del pool fijo, sin coincidir con ningún método real
  const falsas = mezclar(
    METODOS_FALSOS_POOL.filter(m => !textosCorrecto.includes(m))
  ).slice(0, 3);
 
  const opciones = mezclar([respuestaCor, ...falsas]);
 
  return {
    tipo: 'evolucion',
    pregunta: `¿Cómo evoluciona ${pokemon.name}?`,
    imagenUrl: pokemon.sprites.other['official-artwork'].front_default,
    silueta: false,
    opciones,
    respuestaCorrecta: opciones.indexOf(respuestaCor),
    tiempoLimite: 14,
    // Extra: útil para el frontend si quiere mostrar un hint del tipo de trigger
    triggerTipo: detalles[0]?.trigger?.name ?? 'unknown',
  };
}
 
// ─── Función principal ────────────────────────────────────────────────────────
/**
 * Genera una pregunta aleatoria respetando los pesos.
 * Si el tipo elegido no es aplicable al pokemon (p.ej. "genero" sin diferencia),
 * reintenta automáticamente hasta un máximo de 5 veces antes de caer en "nombre".
 */
async function generarPregunta(intentos = 0) {
  if (intentos > 5) {
    // Fallback seguro
    const pokemon = await obtenerPokemonAleatorio();
    return preguntaNombre(pokemon);
  }
 
  const tipoPregunta = elegirTipoPregunta();
  const pokemon = await obtenerPokemonAleatorio();
 
  let resultado = null;
 
  switch (tipoPregunta) {
    case 'nombre':
      resultado = await preguntaNombre(pokemon);
      break;
    case 'tipo':
      resultado = await preguntaTipo(pokemon);
      break;
    case 'numero':
      resultado = await preguntaNumero(pokemon);
      break;
    case 'generacion':
      resultado = await preguntaGeneracion(pokemon);
      break;
    case 'habilidad':
      resultado = await preguntaHabilidad(pokemon);
      break;
    case 'genero':
      resultado = await preguntaGenero(pokemon);
      break;
    case 'evolucion':
      resultado = await preguntaEvolucion(pokemon);
      break;
    default:
      resultado = await preguntaNombre(pokemon);
  }
 
  // Si el generador devuelve null (no aplica para este pokemon), reintentamos
  if (!resultado) return generarPregunta(intentos + 1);
 
  return resultado;
}
 
function mezclar(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}
 
module.exports = { generarPregunta, TIPOS_PREGUNTA_PESOS };