ARG DEPS_HASH_VERSION

# include chamber Docker
FROM segment/chamber:2 AS chamber

FROM 221762091942.dkr.ecr.us-east-1.amazonaws.com/custom-basebot-base:${DEPS_HASH_VERSION} AS build-env
WORKDIR /app

ARG SERVICE_NAME

COPY ./dist/apps/$SERVICE_NAME .
COPY ./configs ./configs
COPY ./versions.env ./versions.env

FROM gcr.io/distroless/nodejs:16
WORKDIR /app
COPY --from=build-env /app /app

COPY --from=chamber /chamber /app/chamber

ARG SERVICE_NAME
COPY --from=build-env /app/configs /app/configs

ENTRYPOINT []
