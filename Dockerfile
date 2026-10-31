FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    TZ=Europe/Berlin \
    TMH_SERVER=1 \
    TMH_HOST=0.0.0.0 \
    TMH_PORT=8765 \
    TMH_DATA=/data

RUN apt-get update \
 && apt-get install -y --no-install-recommends tzdata \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --system --uid 1000 --home /app tigers \
 && mkdir -p /data && chown tigers /data

WORKDIR /app
COPY --chown=tigers server.py website.py ./
COPY --chown=tigers static ./static
COPY --chown=tigers web ./web

USER tigers
VOLUME ["/data"]
EXPOSE 8765

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8765/healthz', timeout=4).status == 200 else 1)"

CMD ["python", "server.py"]
