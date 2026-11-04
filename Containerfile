# Compila en Rust y deja solo el binario y los archivos estáticos en una imagen Debian mínima.
FROM docker.io/library/rust:1-trixie AS build
WORKDIR /src
COPY Cargo.toml Cargo.lock ./
COPY src src
COPY migrations migrations
COPY templates templates
RUN cargo build --release --locked

FROM docker.io/library/debian:trixie-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 10001 finansy
WORKDIR /app
COPY --from=build /src/target/release/finansy /app/finansy
COPY static /app/static
USER finansy
ENV STATIC_DIR=/app/static PORT=3000
EXPOSE 3000
CMD ["/app/finansy"]
