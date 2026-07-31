#!/bin/sh
set -eu

HOST="${PUBLIC_HOST:-localhost}"
ACME_EMAIL="${ACME_EMAIL:-}"
# TLS_MODE : auto (défaut) | letsencrypt | selfsigned
TLS_MODE="${TLS_MODE:-auto}"
SITES=/etc/caddy/sites.caddy
CERT_DIR=/data/certs
CERT="$CERT_DIR/cert.pem"
KEY="$CERT_DIR/key.pem"

# Un domaine public = contient des lettres ET au moins un point, hors localhost/IP.
is_public_domain() {
	case "$1" in
		localhost | *.localhost | *.local | *.internal) return 1 ;;
	esac
	case "$1" in
		*[a-zA-Z]*) : ;;
		*) return 1 ;;
	esac
	case "$1" in
		*.*) return 0 ;;
		*) return 1 ;;
	esac
}

mode=selfsigned
case "$TLS_MODE" in
	letsencrypt) mode=letsencrypt ;;
	selfsigned) mode=selfsigned ;;
	*)
		if is_public_domain "$HOST"; then
			mode=letsencrypt
		fi
		;;
esac

if [ "$mode" = "letsencrypt" ]; then
	echo "TLS: Let's Encrypt (ACME) pour $HOST"
	{
		# Site nommé → Caddy obtient/renouvelle le certificat Let's Encrypt
		# automatiquement et redirige HTTP→HTTPS (le port 80 doit rester
		# accessible depuis Internet pour le challenge HTTP-01).
		echo "$HOST {"
		if [ -n "$ACME_EMAIL" ]; then
			echo "	tls $ACME_EMAIL"
		fi
		echo "	header Strict-Transport-Security \"max-age=31536000; includeSubDomains\""
		echo "	import app"
		echo "}"
	} > "$SITES"
else
	echo "TLS: certificat auto-signé pour PUBLIC_HOST=$HOST (IP/localhost — Let's Encrypt indisponible)"
	mkdir -p "$CERT_DIR"
	if [ ! -f "$CERT" ] || [ ! -f "$KEY" ]; then
		SAN="DNS:localhost,IP:127.0.0.1"
		case "$HOST" in
			*[a-zA-Z]*) SAN="$SAN,DNS:$HOST" ;;
			*) SAN="$SAN,IP:$HOST" ;;
		esac
		openssl req -x509 -newkey rsa:2048 -sha256 -nodes -days 3650 \
			-keyout "$KEY" \
			-out "$CERT" \
			-subj "/CN=$HOST" \
			-addext "subjectAltName=$SAN"
		echo "Certificat auto-signé écrit dans $CERT_DIR"
	fi
	cat > "$SITES" <<EOF
:80 {
	import app
}

:443 {
	tls $CERT $KEY
	import app
}
EOF
fi

exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
