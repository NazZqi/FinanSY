# FinanSY — Ahorremos juntos

App web para ahorrar con amigos. Cada meta es un **jarrón**: individual (solo tuyo) o grupal (una meta común, como un viaje). Todos ven el avance, hay rachas, ranking y retos, y un simulador responde tres preguntas: cuánto aportar al mes, cuándo llegas a la meta y si conviene ahorrar o comprar en cuotas.

**FinanSY no mueve dinero.** Cada persona registra lo que ahorra y la plata sigue en su banco.

La versión anterior (simulador de compras en cuotas en React) quedó en el tag `v2-cuotas`.

## Stack

- **Rust**: Axum genera las páginas en el servidor (plantillas Askama) y HTMX las actualiza sin recargar.
- **Supabase**: Postgres en el schema `finansy`, que no está expuesto en la Data API.
- **Nextcloud**: login vía OpenID Connect (app "OIDC Identity Provider" del servidor propio), flujo PKCE hecho en el servidor.
- **Cinderlink**: contenedor Podman detrás de Caddy y del túnel de Cloudflare.

```
src/
  main.rs     arranque: variables de entorno, pool, migraciones
  lib.rs      estado de la app
  auth.rs     login con Nextcloud (OIDC) y sesión en cookie cifrada
  db.rs       consultas (toda consulta de un jarrón exige ser miembro activo)
  routes.rs   rutas y validación de formularios
  views.rs    datos que ven las plantillas
  sim.rs      simulador (funciones puras)
  game.rs     rachas, ranking, retos y gráfico (funciones puras)
templates/    HTML con Askama
static/       app.css y htmx.min.js
migrations/   SQL que corre al arrancar
deploy/       Quadlets, timer y script de despliegue
```

## Desarrollo local

Requisitos: Rust estable. En Windows, además, Visual Studio Build Tools con C++.

Crea un `.env` (no se commitea) con:

| Variable | Qué es |
|---|---|
| `DATABASE_URL` | Session pooler de Supabase (puerto 5432), usuario `finansy_app.<ref>` |
| `NEXTCLOUD_URL` | Origen de tu Nextcloud, por ejemplo `https://nube.example.cl` |
| `NEXTCLOUD_CLIENT_ID` | Cliente OIDC creado en Nextcloud (ver abajo) |
| `NEXTCLOUD_CLIENT_SECRET` | Secreto de ese cliente |
| `COOKIE_KEY` | 64 bytes aleatorios en hex (128 caracteres) |
| `BASE_URL` | `http://localhost:3000` en local |

```
cargo run
```

## Tests

```
cargo test                          # simulador, juego y login (sin base de datos)
cargo test -- --include-ignored     # + tests de autorización: necesitan DATABASE_URL de un Postgres propio
```

El CI de GitHub corre todo contra `postgres:17`.

## Supabase

Dos proyectos: `finansy-prod` y `finansy-qa` (región `sa-east-1`). En cada uno:

1. El rol `finansy_app` es dueño del schema `finansy` y tiene `search_path = finansy`. La app se conecta con ese rol, no con `postgres`.
Supabase ya no hace login: solo guarda la base de datos.

## Nextcloud

En el Nextcloud del servidor (una vez por entorno, QA y prod por separado):

1. Instala la app **OIDC Identity Provider** (Ajustes de administración → Aplicaciones).
2. Ajustes de administración → OIDC Identity Provider → agrega un cliente con redirect URI `<BASE_URL>/auth/callback`. Guarda el Client ID y el Secret en `secrets/{qa,prod}.env`.
3. Comprueba que `<NEXTCLOUD_URL>/.well-known/openid-configuration` responde JSON.

Los proyectos gratis se pausan tras 7 días sin actividad. El timer `finansy-ping` llama a `/salud` una vez al día para evitarlo.

## Despliegue en Cinderlink

| Entorno | URL | Puerto local | Acceso |
|---|---|---|---|
| QA | `qa-finansy.cinderlink.cl` | 3103 | Privado: solo LAN o Tailscale (desde internet da 404) |
| Prod | `finansy.cinderlink.cl` | 3104 | Público, con el login propio de la app |

Una sola vez:

```
cp deploy/finansy-qa.container deploy/finansy-prod.container ~/.config/containers/systemd/
cp deploy/finansy-ping.service deploy/finansy-ping.timer ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now finansy-ping.timer
```

Las variables van en `/mnt/datos/finansy/secrets/{qa,prod}.env` (permisos 600). Nunca en el repo.

Cada versión:

```
cd /mnt/datos/finansy/src && git pull
deploy/desplegar.sh qa      # compila y publica en QA
deploy/desplegar.sh prod    # publica en prod la misma imagen probada en QA
```

## Licencia

MIT. Ver `LICENSE`.
