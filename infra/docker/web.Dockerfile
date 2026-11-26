FROM node:26.13.1-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5 AS build
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY frontend/ ./
COPY references/piui-modern/ /src/references/piui-modern/
COPY references/piui-zero/ /src/references/piui-zero/
COPY assets/ /src/assets/
COPY contracts/policy/permissions.v1.json /src/contracts/policy/permissions.v1.json
RUN npm run build
FROM nginx:1.30.7-alpine-slim@sha256:8c950211a641ec5b23f265450517001f6bcca533666120ebe36cb4cff3d00a55
COPY infra/nginx/nginx.conf /etc/nginx/nginx.conf
COPY infra/nginx/routes.conf /etc/nginx/routes.conf
COPY infra/nginx/nginx.prod.conf /etc/nginx/nginx.prod.conf
COPY --from=build /src/frontend/dist/ /usr/share/nginx/html/
USER 101:101
EXPOSE 8080 8443
ENTRYPOINT ["nginx", "-g", "daemon off;"]
