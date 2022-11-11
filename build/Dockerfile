FROM node:16 AS build-env
WORKDIR /app

ARG SERVICE_NAME

# Copy the package.json of the app to get any app specific built dependencies
# COPY ./dist/apps/$SERVICE_NAME/package.json .
# RUN npm install --omit=dev

# Instead of copying the package.json for the app, we copy the package.json of the main repo.
# This is due to the app's package.json not including all of the transitive dependencies
COPY ./package.json .
RUN npm install --omit=dev
# RUN npm install --save pg
# RUN npm install --save dayjs
# RUN npm install --save knex
# RUN npm install --save ioredis

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
