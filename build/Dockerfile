ARG DEPS_HASH_VERSION

FROM 221762091942.dkr.ecr.us-east-1.amazonaws.com/custom-basebot-base:${DEPS_HASH_VERSION} AS build-env
WORKDIR /app

ARG SERVICE_NAME

COPY ./dist/apps/$SERVICE_NAME .
COPY ./configs ./configs
COPY ./secrets ./secrets
COPY ./versions.env ./versions.env

FROM gcr.io/distroless/nodejs:16
WORKDIR /app
COPY --from=build-env /app /app

ARG SERVICE_NAME
COPY --from=build-env /app/configs /app/configs
COPY --from=build-env /app/secrets /app/secrets

CMD ["main.js"]
