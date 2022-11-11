FROM node:16 AS build-env
WORKDIR /app

ARG SERVICE_NAME

# Copy the package.json of the app to get any app specific built dependencies
# COPY ./dist/apps/$SERVICE_NAME/package.json .
# RUN npm install --omit=dev

# Instead of copying the package.json for the app, we copy the package.json of the main repo.
# This is due to the app's package.json not including all of the transitive dependencies.
# When Nx fixes the issue with transitive dependencies, we can move back to the above package.json
# that pulls only the dependencies of the specified application.
COPY ./package.json .
RUN npm install --omit=dev

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
