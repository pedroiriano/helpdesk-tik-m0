FROM golang:1.27.4-alpine@sha256:70bd7ddea8b6cbe5d6943cde279d6b67feb10cc924fb9100d1d8757c1575b280 AS source
WORKDIR /src/backend
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
COPY configs/ /src/configs/
FROM source AS test
RUN go vet ./... && go test ./...
FROM source AS build
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/helpdesk ./cmd/helpdesk
FROM scratch AS runtime
COPY --from=build /out/helpdesk /helpdesk
COPY configs/M0.json /app/configs/M0.json
COPY migrations/manifest.json migrations/checksums.sha256 /app/migrations/
USER 65532:65532
WORKDIR /app
EXPOSE 8080
ENTRYPOINT ["/helpdesk"]
