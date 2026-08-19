# Un solo contenedor: el servidor de salas sirve tambien el juego ya compilado.
# Asi hay un unico dominio que configurar, el WebSocket va al mismo origen y
# detras de HTTPS pasa a wss sin tocar nada.

FROM node:22-alpine AS construccion
WORKDIR /app
RUN corepack enable

# Las dependencias primero: mientras no cambien, esta capa se reutiliza.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM node:22-alpine AS produccion
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Solo las de produccion: ni vite, ni vitest, ni los 130 MB de playwright.
RUN pnpm install --prod --frozen-lockfile && pnpm store prune

COPY --from=construccion /app/dist ./dist
COPY server ./server
COPY src/net ./src/net
COPY src/game ./src/game
COPY src/core ./src/core
COPY src/art/vehiculo/camuflajes.js src/art/vehiculo/paleta.js ./src/art/vehiculo/
# El catalogo de camuflajes es de ARTE y vive con el arte, pero el servidor lo
# necesita para sembrar la tienda y para negarse a arrancar si un color se sale
# de la banda de su bando. Se copian los dos ficheros exactos que hacen falta y
# no `src/art` entero: el resto de ese directorio importa Three y no pinta nada
# aqui. `tests/art/camuflajes.test.js` vigila que estos dos sigan sin importar
# nada mas, que es lo que hace segura esta linea.

# Node corre como root por defecto en esta imagen; el usuario 'node' ya existe.
USER node

EXPOSE 8787
ENV PUERTO=8787

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PUERTO||8787)+'/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
