const { PrismaClient } = require('@prisma/client');
const { PrismaMariaDb } = require('@prisma/adapter-mariadb');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const adapter = new PrismaMariaDb(process.env.DATABASE_URL);

const prisma = new PrismaClient({ adapter });

async function registrar(nombreUsuario, correo, contraseña) {
  const usuarioExistente = await prisma.usuario.findFirst({
    where: {
      OR: [
        { correo: correo },
        { nombre: nombreUsuario }
      ]
    }
  });

  if (usuarioExistente) {
    if (usuarioExistente.correo === correo) throw new Error('El email ya está en uso');
    if (usuarioExistente.nombre === nombreUsuario) throw new Error('El nombre de usuario ya está en uso');
  }

  const passwordHash = await bcrypt.hash(contraseña, 10);

  const nuevoUsuario = await prisma.usuario.create({
    data: {
      nombre: nombreUsuario,
      correo: correo,
      hashContraseña: passwordHash,
      datos: { create: {} }
    }
  });

  return { id: nuevoUsuario.id, username: nuevoUsuario.nombre };
}

async function login(correo, contraseña) {
  const usuario = await prisma.usuario.findUnique({
    where: { correo: correo }
  });

  if (!usuario) throw new Error('Usuario no encontrado');

  const valido = await bcrypt.compare(contraseña, usuario.hashContraseña);
  if (!valido) throw new Error('Contraseña incorrecta');

  const token = jwt.sign(
    { userId: usuario.id, username: usuario.nombre },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  return { token, username: usuario.nombre, userId: usuario.id };
}

async function obtenerPerfil(userId) {
  const usuario = await prisma.usuario.findUnique({
    where: { id: userId },
    include: { datos: true }
  });

  if (!usuario) throw new Error('Usuario no encontrado');

  return {
    username: usuario.nombre,
    email: usuario.correo,
    creadoEn: usuario.creadoEn,
    estadisticas: {
      partidasJugadas:    usuario.datos.partidasJugadas,
      partidasGanadas:    usuario.datos.partidasGanadas,
      preguntasCorrectas: usuario.datos.preguntasCorrectas,
      puntuacionTotal:    usuario.datos.puntuacionTotal,
      mejorPuntuacion:    usuario.datos.mejorPuntuacion, 
      rachaActual:        usuario.datos.rachaActual,       
      mejorRacha:         usuario.datos.mejorRacha,         
    }
  };
}

async function actualizarEstadisticas(userId, { gano, correctas, puntos, racha }) {
  const datos = await prisma.datosUsuario.findUnique({
    where: { usuarioId: userId }
  });

  await prisma.datosUsuario.update({
    where: { usuarioId: userId },
    data: {
      partidasJugadas:    { increment: 1 },
      partidasGanadas:    { increment: gano ? 1 : 0 },
      preguntasCorrectas: { increment: correctas },
      puntuacionTotal:    { increment: puntos },
      rachaActual:        racha,
      mejorRacha:         racha > datos.mejorRacha ? racha : datos.mejorRacha,
      mejorPuntuacion:    puntos > datos.mejorPuntuacion ? puntos : datos.mejorPuntuacion,
    }
  });
}

module.exports = { registrar, login, obtenerPerfil, actualizarEstadisticas };