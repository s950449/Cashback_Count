FROM --platform=$BUILDPLATFORM python:3.12-slim AS packages

ARG TARGETPLATFORM

WORKDIR /build

COPY requirements.txt .

RUN set -eux; \
    case "$TARGETPLATFORM" in \
        "linux/amd64") PIP_PLATFORMS="manylinux2014_x86_64 manylinux_2_28_x86_64 manylinux_2_34_x86_64" ;; \
        "linux/arm64"|"linux/arm64/v8") PIP_PLATFORMS="manylinux2014_aarch64 manylinux_2_28_aarch64 manylinux_2_34_aarch64" ;; \
        *) echo "Unsupported TARGETPLATFORM: $TARGETPLATFORM" >&2; exit 1 ;; \
    esac; \
    platform_args=""; \
    for platform in $PIP_PLATFORMS; do platform_args="$platform_args --platform $platform"; done; \
    python -m pip install --no-cache-dir \
        --target /python-packages \
        $platform_args \
        --python-version 3.12 \
        --implementation cp \
        --abi cp312 \
        --abi abi3 \
        --abi none \
        --only-binary=:all: \
        -r requirements.txt; \
    mkdir -p /data

FROM --platform=$TARGETPLATFORM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    CASHBACK_DB_PATH=/data/cashback.db \
    PYTHONPATH=/app/python-packages

WORKDIR /app

COPY --from=packages /python-packages ./python-packages
COPY --from=packages /data /data
COPY . ./backend

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
