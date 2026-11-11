# FinanSY — Ahorremos juntos

App web para ahorrar con amigos. Cada meta es un **jarrón**: individual (solo tuyo) o grupal (una meta común, como un viaje). Todos ven el avance, hay rachas, ranking y retos, y un simulador responde tres preguntas: cuánto aportar al mes, cuándo llegas a la meta y si conviene ahorrar o comprar en cuotas.

**FinanSY no mueve dinero.** Cada persona registra lo que ahorra y la plata sigue en su banco.

La versión anterior (simulador de compras en cuotas en React) quedó en el tag `v2-cuotas`.

## Cómo funciona

1. **Entras con Google.** No hay contraseñas propias de la app.
2. **Creas un jarrón** con una meta en pesos y, si quieres, una fecha. Puede ser individual o grupal. Al grupal se entra con un enlace de invitación (`/unirse/<código>`).
3. **Eliges cómo ahorrar.** Frecuencia diaria, semanal o mensual, y un plan: cuota constante, decreciente, creciente o libre. La app calcula cuánto toca en cada período.
4. **Registras cada aporte.** Es solo un registro: monto, fecha y una nota opcional.
5. **Ves el avance.** Barra y anillo de progreso, gráfico de ahorro acumulado, historial y la cuota que falta, recalculada con lo que ya ahorraste y los períodos que quedan.

En un jarrón grupal además hay:

- **Parte de cada uno:** la meta se divide en partes iguales entre los miembros activos.
- **Ranking:** ordena por porcentaje de la parte cumplida.
- **Rachas:** períodos seguidos con al menos un aporte, en la frecuencia del jarrón.
- **Retos:** "cada uno aporta $X entre dos fechas", con el avance de cada miembro.
- **Avisos dentro de la app:** alguien aportó, se unió, cambió la meta o creó un reto. No hay correos ni notificaciones push.
- **Simular juntos:** cualquiera prueba otra meta o fecha y ve la cuota resultante sin guardar; solo el creador guarda el cambio.

La tarjeta **Ritmo** compara tu promedio real con el plan y estima en qué fecha llegas si sigues igual.

El **simulador** (`/simular`) es público y no necesita cuenta. Responde tres preguntas: cuánto aportar al mes, cuándo llegas a la meta y cuánto pagas de más si compras en cuotas en vez de ahorrar.

## En qué está implementado

| Pieza | Tecnología |
|---|---|
| Servidor | Rust con [Axum](https://github.com/tokio-rs/axum) sobre Tokio |
| Páginas | HTML generado en el servidor con plantillas [Askama](https://github.com/askama-rs/askama) |
| Interacción | [HTMX](https://htmx.org): actualiza partes de la página sin recargar. Muy poco JavaScript propio |
| Base de datos | Postgres en Supabase, con `sqlx` y migraciones que corren al arrancar |
| Login | Google mediante Supabase Auth, con el flujo PKCE hecho en el servidor |
| Estilos | Un solo `app.css`, sin framework. Tema claro u oscuro según el sistema |
| Fondo | `bg.js` dibuja un amanecer con caracteres en un `<canvas>` |
| Gráficos | SVG generado en el servidor, sin librería de gráficos |
| Contenedor | Imagen construida con el `Containerfile` |

El navegador solo recibe HTML. No hay API JSON ni app de una sola página: cada acción es un formulario o una petición de HTMX que devuelve un fragmento de HTML.

```
src/
  main.rs     arranque: variables de entorno, pool, migraciones
  lib.rs      estado de la app
  auth.rs     login con Google y sesión en cookie cifrada
  db.rs       consultas (toda consulta de un jarrón exige ser miembro activo)
  routes.rs   rutas y validación de formularios
  views.rs    datos que ven las plantillas
  sim.rs      simulador y planes de ahorro (funciones puras)
  game.rs     rachas, ranking, retos y gráfico (funciones puras)
templates/    HTML con Askama
static/       app.css, app.js, bg.js, htmx.min.js, fuentes e íconos
migrations/   SQL que corre al arrancar
tests/        tests de integración contra Postgres
```

### Decisiones de diseño

- **Dinero en enteros.** Los montos se guardan en pesos chilenos como `bigint`, nunca como decimales de coma flotante.
- **Fechas en hora de Chile.** Semanas, meses y rachas se calculan en `America/Santiago`.
- **La lógica de negocio es pura.** `sim.rs` y `game.rs` no tocan la base de datos, así que se prueban con tests unitarios simples.
- **El plan se recalcula siempre.** La cuota del período sale de lo ya ahorrado y los períodos que faltan; si un mes aportas de más o de menos, el resto se ajusta solo.
- **Avance en vivo por sondeo.** En un jarrón grupal la página vuelve a pedir el panel cada 20 segundos. No hay WebSockets.

### Seguridad

- **Autorización en el servidor.** Toda ruta de un jarrón comprueba que seas miembro activo; si no, responde 404. Cada uno agrega y borra solo sus aportes, y solo el creador cambia la meta o borra el jarrón.
- **Base no expuesta.** Las tablas viven en un schema que la Data API de Supabase no publica, con RLS activado. Solo el servidor habla con la base.
- **Sesión propia.** Tras el login la app guarda una cookie cifrada (`HttpOnly`, `Secure`, `SameSite=Lax`) y no conserva los tokens de Supabase.
- **CSRF.** Todo `POST` cuyo encabezado `Origin` no sea el de la app se rechaza.
- **Fotos.** La foto de un jarrón se decodifica con límites, se reduce y se recodifica a JPEG, lo que elimina metadatos como la ubicación.

## Desarrollo local

Requisitos: Rust estable. En Windows, además, Visual Studio Build Tools con C++.

Crea un `.env` (no se commitea) con:

| Variable | Qué es |
|---|---|
| `DATABASE_URL` | Session pooler de Supabase (puerto 5432), usuario `finansy_app.<ref>` |
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Llave publicable (`sb_publishable_…`) |
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

## Licencia

MIT. Ver `LICENSE`.
