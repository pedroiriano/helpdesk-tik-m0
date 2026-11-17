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
FROM nginx:1.30.6-alpine@sha256:901e593c95dc85f5a729f5765516321366ef4ac401821431d408897e95287d0a
COPY infra/nginx/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /src/frontend/dist/ /usr/share/nginx/html/
USER 101:101
EXPOSE 8080
ENTRYPOINT ["nginx", "-g", "daemon off;"]
