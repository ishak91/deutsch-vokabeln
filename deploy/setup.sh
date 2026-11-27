#!/usr/bin/env bash
# One-time server setup for Ubuntu (Oracle Cloud Always Free, ARM or x86).
# Run inside the german-vocab folder:   bash deploy/setup.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== 1/5 Installing Docker (skipped if already installed)"
if ! command -v docker >/dev/null 2>&1; then
  # Older Ubuntu releases lack some optional packages; fall back to the core set
  curl -fsSL https://get.docker.com | sudo sh || \
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin docker-buildx-plugin
  sudo usermod -aG docker "$USER" || true
fi
DOCKER="sudo docker"

echo "== 2/5 Opening ports 80 and 443 in the server firewall"
for p in 80 443; do
  sudo iptables -C INPUT -p tcp --dport $p -j ACCEPT 2>/dev/null || sudo iptables -I INPUT 5 -p tcp --dport $p -j ACCEPT
done
if command -v netfilter-persistent >/dev/null 2>&1; then sudo netfilter-persistent save; else
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y iptables-persistent >/dev/null && sudo netfilter-persistent save; fi

echo "== 3/5 Address"
IP="${1:-$(curl -fsS https://api.ipify.org || true)}"
DEFAULT_DOMAIN="${IP//./-}.sslip.io"
read -rp "Web address [${DEFAULT_DOMAIN}] (press Enter to accept, or type your own domain): " DOMAIN
DOMAIN="${DOMAIN:-$DEFAULT_DOMAIN}"

echo "== 4/5 HTTPS config"
# No password here: the app has its own accounts. Create the first (admin) account right after the start.
cat > deploy/Caddyfile <<CADDY
$DOMAIN {
	encode gzip
	reverse_proxy web:3000
}
CADDY

echo "== 5/5 Building and starting (first time takes 5-15 minutes)"
$DOCKER compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
# Caddy only reads its config at start, so recreate it to pick up a new domain
$DOCKER compose -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate caddy

echo
echo "Done! Open https://$DOMAIN  (the HTTPS certificate can take a minute on the first visit)"
echo "Open it now and create the first account: it becomes the admin, who can add other learners."
