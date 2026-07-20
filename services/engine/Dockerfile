FROM rust:1.95-bookworm AS build
WORKDIR /workspace
COPY .cargo .cargo
COPY services/engine services/engine
RUN cargo build --manifest-path services/engine/Cargo.toml --release

FROM debian:bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
RUN useradd --system --uid 10001 --create-home chartize
WORKDIR /app
COPY --from=build /workspace/services/engine/target/release/chartize-engine /usr/local/bin/chartize-engine
RUN mkdir -p /data && chown chartize:chartize /data
USER chartize
ENV DATA_ROOT=/data
ENV ENGINE_BIND=0.0.0.0:8787
EXPOSE 8787
CMD ["chartize-engine"]
