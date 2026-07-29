FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    LOG_DIR=/var/log/running-dashboards/host-logs \
    LOG_LEVEL=INFO

# Miroir FR plus rapide que deb.debian.org (souvent lent / timeouts)
RUN sed -i 's/deb.debian.org/ftp.fr.debian.org/g' /etc/apt/sources.list.d/*.sources \
    && sed -i 's/deb.debian.org/ftp.fr.debian.org/g' /etc/apt/sources.list 2>/dev/null || true \
    && apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /var/log/running-dashboards/host-logs

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
