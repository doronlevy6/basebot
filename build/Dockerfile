FROM node:16 AS build-env
WORKDIR /app

ARG SERVICE_NAME
COPY ./dist/apps/$SERVICE_NAME/package.json .
RUN npm install --production
RUN npm install --save pg
RUN npm install --save dayjs
RUN npm install --save knex

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
