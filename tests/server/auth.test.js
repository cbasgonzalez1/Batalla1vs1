import { describe, it, expect } from 'vitest';
import {
  cifrarClave, claveCorrecta, huellaDe, normalizarCorreo, nuevaSesion, tokenDe,
  validarRegistro, MINIMO_CLAVE,
} from '../../server/auth.js';

/**
 * Lo que pasa con una contrasena y con un token, probado sin base de datos.
 *
 * Es la parte del servidor donde un fallo no se ve en una captura ni lo caza una
 * verificacion de navegador: o se prueba aqui o no se prueba.
 */

describe('validar lo que llega de fuera', () => {
  const bueno = { correo: 'a@b.com', clave: 'doceletras', nombre: 'Ana' };

  it('acepta un registro correcto', () => {
    expect(validarRegistro(bueno)).toBe(null);
  });

  it.each([
    ['sin arroba', { correo: 'ab.com' }],
    ['sin dominio', { correo: 'a@b' }],
    ['vacio', { correo: '' }],
  ])('rechaza un correo %s', (_, malo) => {
    expect(validarRegistro({ ...bueno, ...malo })).toMatch(/correo/);
  });

  it('rechaza una contrasena corta', () => {
    expect(validarRegistro({ ...bueno, clave: 'a'.repeat(MINIMO_CLAVE - 1) })).toMatch(/contrasena/);
  });

  it('rechaza una contrasena absurda', () => {
    // Scrypt sobre un megabyte de contrasena es una forma barata de tumbar el
    // servidor: el tope no es cosmetico.
    expect(validarRegistro({ ...bueno, clave: 'a'.repeat(5000) })).toMatch(/larga/);
  });

  it.each([['x'], ['a'.repeat(25)]])('rechaza el nombre %s', (nombre) => {
    expect(validarRegistro({ ...bueno, nombre })).toMatch(/nombre/);
  });

  it('normaliza el correo a minusculas y sin espacios', () => {
    expect(normalizarCorreo('  Ana@Correo.COM ')).toBe('ana@correo.com');
    // Sin esto, el mismo jugador se registra dos veces cambiando una mayuscula.
    expect(validarRegistro({ ...bueno, correo: 'ANA@B.COM' })).toBe(null);
  });
});

describe('la contrasena no se guarda', () => {
  it('lo guardado no contiene la contrasena', async () => {
    const guardado = await cifrarClave('caballocorrectobateria');
    expect(guardado).not.toContain('caballocorrectobateria');
    expect(guardado).toMatch(/^[0-9a-f]{32}\$[0-9a-f]{128}$/);
  });

  it('dos veces la misma contrasena dan hashes distintos', async () => {
    // Sal por jugador: sin ella, dos cuentas con la misma contrasena se ven
    // iguales en la tabla y una tabla arcoiris las abre las dos.
    const a = await cifrarClave('lamismaclave');
    const b = await cifrarClave('lamismaclave');
    expect(a).not.toBe(b);
  });

  it('reconoce la buena y rechaza la mala', async () => {
    const guardado = await cifrarClave('lamismaclave');
    expect(await claveCorrecta('lamismaclave', guardado)).toBe(true);
    expect(await claveCorrecta('lamismaclav', guardado)).toBe(false);
    expect(await claveCorrecta('', guardado)).toBe(false);
  });

  it.each([[''], ['sinseparador'], ['aa$bb'], [null], [undefined]])(
    'no revienta con %s guardado', async (guardado) => {
      expect(await claveCorrecta('loquesea', guardado)).toBe(false);
    },
  );
});

describe('el token de sesion tampoco se guarda', () => {
  it('lo que va a la base de datos es la huella, no el token', () => {
    const s = nuevaSesion();
    expect(s.huella).toBe(huellaDe(s.token));
    expect(s.huella).not.toBe(s.token);
    expect(s.huella).toMatch(/^[0-9a-f]{64}$/);
  });

  it('dos sesiones no se parecen en nada', () => {
    expect(nuevaSesion().token).not.toBe(nuevaSesion().token);
  });

  it('caduca en el futuro', () => {
    expect(nuevaSesion({ dias: 1 }).caduca.getTime()).toBeGreaterThan(Date.now());
  });
});

describe('leer el token de la cabecera', () => {
  it('saca el Bearer', () => {
    expect(tokenDe({ authorization: 'Bearer abc123' })).toBe('abc123');
    expect(tokenDe({ Authorization: 'bearer abc123' })).toBe('abc123');
  });

  it.each([[{}], [{ authorization: 'abc' }], [{ authorization: 'Basic abc' }]])(
    'devuelve null con %o', (cabeceras) => {
      expect(tokenDe(cabeceras)).toBe(null);
    },
  );
});
