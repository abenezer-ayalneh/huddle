# Build the official community source because its published images/binary
# endpoints are no longer available. Keep this local fallback out of production.
FROM golang:1.24.8-alpine AS builder
ENV CGO_ENABLED=0 GOTOOLCHAIN=local
# RELEASE.2025-10-15T17-29-55Z, pinned to its upstream commit.
RUN go install github.com/minio/minio@9e49d5e7a648f00e26f2246f4dc28e6b07f8c84a

FROM alpine:3.22
RUN apk add --no-cache ca-certificates
COPY --from=builder /go/bin/minio /usr/local/bin/minio
ENTRYPOINT ["minio"]
CMD ["server", "/data", "--console-address", ":9001"]
