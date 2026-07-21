#!/usr/bin/env bash
set -euo pipefail

readonly SOURCE_CONFIG="/home/dialup/chartize/infra/nginx/chartize.dileepreddy.com.conf"
readonly SOURCE_PASSWORD="/home/dialup/.htpasswd-chartize.install"
readonly AVAILABLE_CONFIG="/etc/nginx/sites-available/chartize"
readonly ENABLED_CONFIG="/etc/nginx/sites-enabled/chartize"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this installer with sudo." >&2
  exit 1
fi

test -f "${SOURCE_CONFIG}"
test -f "${SOURCE_PASSWORD}"

install -o root -g root -m 0644 "${SOURCE_CONFIG}" "${AVAILABLE_CONFIG}"
install -o root -g www-data -m 0640 "${SOURCE_PASSWORD}" /etc/nginx/.htpasswd-chartize

if [[ -L "${ENABLED_CONFIG}" ]]; then
  if [[ "$(readlink "${ENABLED_CONFIG}")" != "${AVAILABLE_CONFIG}" ]]; then
    echo "Refusing to replace an unexpected ${ENABLED_CONFIG} symlink." >&2
    exit 1
  fi
elif [[ -e "${ENABLED_CONFIG}" ]]; then
  echo "Refusing to replace the existing ${ENABLED_CONFIG}." >&2
  exit 1
else
  ln -s "${AVAILABLE_CONFIG}" "${ENABLED_CONFIG}"
fi

nginx -t
systemctl reload nginx
