-- Esquema de artilleria-1v1.
--
-- Se aplica entero en cada arranque y es IDEMPOTENTE: todo lleva IF NOT EXISTS.
-- No hay herramienta de migraciones y no hace falta todavia; cuando la haya, este
-- fichero es la migracion 001 y las siguientes se anaden numeradas al lado.
--
-- ── LO QUE GUARDA, Y LO QUE NO ───────────────────────────────────────────
--
-- Guarda TODO lo que tiene que sobrevivir a cerrar el juego: quien eres, que
-- tienes desbloqueado, que compraste y como fue cada combate.
--
-- NO guarda el estado de una partida en curso. Ni el terreno, ni las vidas, ni
-- el turno. En el momento en que esta base de datos tiene una opinion sobre como
-- va un combate, el servidor pasa a ser una segunda verdad y se cae la
-- restriccion dura de AGENTS.md: el servidor no simula (`docs/PLATAFORMA.md`
-- §0.1 y §4.2). El estado vive en los moviles.
--
-- ── Y AUN ASI GUARDA LA PARTIDA ENTERA ───────────────────────────────────
--
-- Porque la simulacion es determinista. Con la semilla y la lista de tiros,
-- cualquier movil reconstruye el combate golpe a golpe: no hay que guardar donde
-- cayo cada proyectil, basta con `partida.repeticion`, que es el mismo formato
-- del enlace que ya se comparte (`src/game/replay.js`). Una partida de dieciseis
-- turnos ocupa unos cien bytes en vez de un volcado de estado.
--
-- Eso es lo que hace que «guardar todo del juego» sea barato aqui y carisimo en
-- un juego que no fuera determinista.

CREATE TABLE IF NOT EXISTS jugador (
  id            uuid PRIMARY KEY,
  -- El correo se guarda en minusculas y se compara asi: sin esto, el mismo
  -- jugador se registra dos veces cambiando una mayuscula.
  correo        text NOT NULL UNIQUE,
  -- LA CONTRASENA NO SE GUARDA. Aqui vive `sal$derivada` de scrypt: ni el que
  -- lea esta tabla ni el que se lleve una copia pueden entrar en ninguna cuenta.
  clave         text NOT NULL,
  nombre        text NOT NULL,
  -- Lo elegido en la tienda. Va en `jugador` y no en su propia tabla porque es
  -- una fila por jugador y siempre se lee con el: una tabla mas seria una junta
  -- en cada inicio de sesion para leer dos textos.
  camuflaje_a   text,
  camuflaje_b   text,
  idioma        text,
  creado        timestamptz NOT NULL DEFAULT now(),
  visto         timestamptz NOT NULL DEFAULT now()
);

-- Sesiones abiertas. Una por dispositivo.
--
-- EL TOKEN TAMPOCO SE GUARDA: aqui va su sha256. El token viaja al movil una vez
-- y no vuelve a existir en el servidor, asi que una copia de esta tabla no abre
-- ni una sesion.
CREATE TABLE IF NOT EXISTS sesion (
  id            uuid PRIMARY KEY,
  jugador_id    uuid NOT NULL REFERENCES jugador(id) ON DELETE CASCADE,
  huella        text NOT NULL UNIQUE,
  dispositivo   text,
  creada        timestamptz NOT NULL DEFAULT now(),
  caduca        timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sesion_por_jugador ON sesion (jugador_id);
CREATE INDEX IF NOT EXISTS sesion_por_caducidad ON sesion (caduca);

-- El catalogo de la tienda. Lo siembra el servidor al arrancar desde
-- `src/art/vehiculo/camuflajes.js`, que es la unica fuente de verdad: un color
-- de arte que solo viva en la base de datos deja de ser una decision.
CREATE TABLE IF NOT EXISTS camuflaje (
  id            text PRIMARY KEY,
  bando         char(1) NOT NULL CHECK (bando IN ('a', 'b')),
  nombre        text NOT NULL,
  -- UN NUMERO. 0xRRGGBB, y de el se calcula el vehiculo entero.
  base          integer NOT NULL,
  centimos      integer NOT NULL DEFAULT 0 CHECK (centimos >= 0),
  activo        boolean NOT NULL DEFAULT true,
  orden         integer NOT NULL DEFAULT 0
);

-- Que tiene cada jugador. Un desbloqueo no se borra nunca: si un camuflaje se
-- retira de la tienda, el que lo compro lo conserva.
CREATE TABLE IF NOT EXISTS desbloqueo (
  jugador_id    uuid NOT NULL REFERENCES jugador(id) ON DELETE CASCADE,
  camuflaje_id  text NOT NULL REFERENCES camuflaje(id),
  origen        text NOT NULL CHECK (origen IN ('serie', 'compra', 'regalo', 'logro')),
  compra_id     uuid,
  creado        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (jugador_id, camuflaje_id)
);

-- Compras. La tabla existe ANTES que el pago a proposito.
--
-- El pago llegara por el billing de Apple y de Google, que es obligatorio para
-- un bien digital dentro de una app (`docs/PLATAFORMA.md` §5.2): aqui se guarda
-- el recibo que devuelve el SDK y el estado de su validacion contra la tienda.
-- ESTE SERVIDOR NO VE UNA TARJETA NUNCA, y por eso no hay ni un campo para ella.
CREATE TABLE IF NOT EXISTS compra (
  id            uuid PRIMARY KEY,
  jugador_id    uuid NOT NULL REFERENCES jugador(id) ON DELETE CASCADE,
  camuflaje_id  text NOT NULL REFERENCES camuflaje(id),
  tienda        text NOT NULL CHECK (tienda IN ('apple', 'google', 'regalo')),
  -- Unico por tienda: es lo que impide canjear dos veces el mismo recibo.
  recibo        text NOT NULL,
  estado        text NOT NULL CHECK (estado IN ('pendiente', 'validada', 'rechazada', 'devuelta')),
  centimos      integer NOT NULL,
  moneda        char(3) NOT NULL DEFAULT 'EUR',
  creada        timestamptz NOT NULL DEFAULT now(),
  validada      timestamptz,
  UNIQUE (tienda, recibo)
);
CREATE INDEX IF NOT EXISTS compra_por_jugador ON compra (jugador_id);

-- Una partida TERMINADA. Nunca una en curso.
CREATE TABLE IF NOT EXISTS partida (
  id            uuid PRIMARY KEY,
  codigo_sala   text,
  semilla       text NOT NULL,
  teatro        text,
  suelo         text,
  -- El combate entero: `semilla~turno.turno.turno` (`src/game/replay.js`).
  -- Con esto se vuelve a jugar exacto en cualquier dispositivo.
  repeticion    text,
  turnos        integer NOT NULL DEFAULT 0,
  ganador       char(1) CHECK (ganador IN ('a', 'b')),
  empezada      timestamptz NOT NULL DEFAULT now(),
  terminada     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS partida_por_fecha ON partida (terminada DESC);

-- Quien jugo cada partida y como le fue.
--
-- `jugador_id` puede ser NULL: se juega sin cuenta entrando con un codigo de
-- sala, y esa partida se guarda igual. Lo que no tiene es a quien sumarle el
-- progreso.
CREATE TABLE IF NOT EXISTS participacion (
  partida_id    uuid NOT NULL REFERENCES partida(id) ON DELETE CASCADE,
  puesto        integer NOT NULL,
  jugador_id    uuid REFERENCES jugador(id) ON DELETE SET NULL,
  bando         char(1) NOT NULL CHECK (bando IN ('a', 'b')),
  nombre        text NOT NULL,
  camuflaje_id  text,
  vida_final    integer NOT NULL DEFAULT 0,
  disparos      integer NOT NULL DEFAULT 0,
  aciertos      integer NOT NULL DEFAULT 0,
  dano          integer NOT NULL DEFAULT 0,
  PRIMARY KEY (partida_id, puesto)
);
CREATE INDEX IF NOT EXISTS participacion_por_jugador ON participacion (jugador_id);

-- El progreso, y es UNA CACHE.
--
-- Todo lo de aqui se puede recalcular sumando `participacion`, y hay una
-- consulta que lo hace (`recomponerProgreso`). Se guarda aparte porque la
-- vitrina de un jugador se lee en cada pantalla de inicio y sumar su historial
-- entero cada vez es tirar la base de datos por una cifra que casi nunca cambia.
--
-- Que sea una cache es la razon por la que puede vivir sin auditar: si algun dia
-- hay clasificacion competitiva habra que verificar las partidas antes de sumar
-- (`docs/PLATAFORMA.md` §4.4), y entonces se recompone y ya.
CREATE TABLE IF NOT EXISTS progreso (
  jugador_id    uuid PRIMARY KEY REFERENCES jugador(id) ON DELETE CASCADE,
  partidas      integer NOT NULL DEFAULT 0,
  ganadas       integer NOT NULL DEFAULT 0,
  disparos      integer NOT NULL DEFAULT 0,
  aciertos      integer NOT NULL DEFAULT 0,
  dano          bigint  NOT NULL DEFAULT 0,
  mejor_impacto integer NOT NULL DEFAULT 0,
  actualizado   timestamptz NOT NULL DEFAULT now()
);
