#!/bin/sh
set -eu

CERT_DIR=/data/certs
CERT="$CERT_DIR/cert.pem"
KEY="$CERT_DIR/key.pem"
HOST="${PUBLIC_HOST:-localhost}"

mkdir -p "$CERT_DIR"

need_new_cert=0
if [ ! -f "$CERT" ] || [ ! -f "$KEY" ]; then
	need_new_cert=1
fi

if [ "$need_new_cert" -eq 1 ]; then
	echo "Génération certificat TLS pour PUBLIC_HOST=$HOST"
	SAN="DNS:localhost,IP:127.0.0.1"
	case "$HOST" in
		*[a-zA-Z]*)
			SAN="$SAN,DNS:$HOST"
			;;
		*)
			SAN="$SAN,IP:$HOST"
			;;
	esac

	openssl req -x509 -newkey rsa:2048 -sha256 -nodes -days 3650 \
		-keyout "$KEY" \
		-out "$CERT" \
		-subj "/CN=$HOST" \
		-addext "subjectAltName=$SAN"
	echo "Certificat écrit dans $CERT_DIR"
fi

exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
