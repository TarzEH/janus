#!/bin/sh
# JANUS installer — macOS and Linux.
#
#   curl -fsSL https://raw.githubusercontent.com/TarzEH/janus/main/install.sh | sh
#
# Installs a standalone binary. No Node, no npm, no dependencies on the target.
#
# Environment:
#   JANUS_VERSION       tag to install (default: latest release)
#   JANUS_INSTALL_DIR   where to put the binary (default: see pick_install_dir)
#   GITHUB_TOKEN        optional; raises the GitHub API rate limit
#
# Piping a script from the internet into a shell is exactly the supply-chain
# problem this project exists to talk about. Read it first — that is the whole
# point of `-fsSL` without `| sh`. The binary it fetches is checksum-verified
# against SHA256SUMS from the same release before anything lands in your PATH.
set -eu

REPO="TarzEH/janus"
BIN_NAME="janus"

say()  { printf '%s\n' "$*" >&2; }
die()  { printf 'janus: %s\n' "$*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "required command not found: $1"; }

need uname
need mktemp
command -v curl >/dev/null 2>&1 || command -v wget >/dev/null 2>&1 || die "need curl or wget"

# ── platform ────────────────────────────────────────────────────────────────
detect_target() {
  os=$(uname -s)
  arch=$(uname -m)

  case "$os" in
    Darwin) os=darwin ;;
    Linux)  os=linux ;;
    *) die "unsupported OS: $os. Windows users: use install.ps1. Otherwise: npm i -g janus-cli" ;;
  esac

  case "$arch" in
    x86_64|amd64)  arch=x64 ;;
    arm64|aarch64) arch=arm64 ;;
    *) die "unsupported architecture: $arch. Try: npm i -g janus-cli" ;;
  esac

  # There is no darwin-arm64-only gap to paper over: Rosetta would run the x64
  # build, but shipping the native one is faster and we build it anyway.
  printf '%s-%s' "$os" "$arch"
}

# ── fetch helpers ───────────────────────────────────────────────────────────
AUTH_HEADER=""
[ -n "${GITHUB_TOKEN:-}" ] && AUTH_HEADER="Authorization: Bearer $GITHUB_TOKEN"

fetch() { # fetch <url> <dest|-> [accept]
  _url=$1; _dest=$2; _accept=${3:-}
  if command -v curl >/dev/null 2>&1; then
    set -- -fsSL
    [ -n "$AUTH_HEADER" ] && set -- "$@" -H "$AUTH_HEADER"
    [ -n "$_accept" ] && set -- "$@" -H "Accept: $_accept"
    if [ "$_dest" = "-" ]; then curl "$@" "$_url"; else curl "$@" -o "$_dest" "$_url"; fi
  else
    set -- -q -O "$([ "$_dest" = "-" ] && echo - || echo "$_dest")"
    [ -n "$AUTH_HEADER" ] && set -- --header="$AUTH_HEADER" "$@"
    [ -n "$_accept" ] && set -- --header="Accept: $_accept" "$@"
    wget "$@" "$_url"
  fi
}

release_json() {
  if [ -n "${JANUS_VERSION:-}" ]; then
    _url="https://api.github.com/repos/$REPO/releases/tags/$JANUS_VERSION"
  else
    _url="https://api.github.com/repos/$REPO/releases/latest"
  fi
  fetch "$_url" - "application/vnd.github+json" 2>/dev/null || printf ''
}

json_tag() { printf '%s' "$1" | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1; }

# The API URL for one named asset.
#
# On a PRIVATE repository the browser path (…/releases/download/tag/asset) 404s
# even with a valid token; only the asset API endpoint with
# `Accept: application/octet-stream` works. That is also the documented path for
# public repos, so this is the one route rather than a special case.
#
# Fields are comma-separated in the JSON, and an asset object lists its own
# "url" before its "name", so remembering the last assets URL seen and printing
# it when the wanted name shows up is correct. The nested "uploader" object has
# a "url" too, but it points at /users/… and cannot match the pattern.
#
# Whitespace-tolerant on purpose: the API serves this pretty-printed in some
# conditions and compact in others, and a parser that only handles one of them
# fails at the worst possible moment.
asset_url() { # asset_url <release-json> <asset-name>
  printf '%s' "$1" | tr ',' '\n' | awk -v want="$2" '
    /"url"[[:space:]]*:[[:space:]]*"https:\/\/api\.github\.com\/repos\/[^"]*\/releases\/assets\/[0-9]+"/ {
      u = $0
      sub(/^.*"url"[[:space:]]*:[[:space:]]*"/, "", u)
      sub(/".*$/, "", u)
    }
    $0 ~ "\"name\"[[:space:]]*:[[:space:]]*\"" want "\"" { print u; exit }
  '
}

# ── install location ────────────────────────────────────────────────────────
pick_install_dir() {
  if [ -n "${JANUS_INSTALL_DIR:-}" ]; then printf '%s' "$JANUS_INSTALL_DIR"; return; fi
  # Prefer a directory already on PATH and writable without sudo. Silently
  # sudo-ing to /usr/local/bin is a surprise nobody wants from a one-liner.
  for d in "$HOME/.local/bin" /usr/local/bin; do
    if [ -d "$d" ] && [ -w "$d" ]; then printf '%s' "$d"; return; fi
  done
  printf '%s' "$HOME/.local/bin"
}

# ── checksum ────────────────────────────────────────────────────────────────
verify_sha256() { # verify_sha256 <file> <expected>
  if command -v sha256sum >/dev/null 2>&1; then
    _actual=$(sha256sum "$1" | cut -d' ' -f1)
  elif command -v shasum >/dev/null 2>&1; then
    _actual=$(shasum -a 256 "$1" | cut -d' ' -f1)
  else
    say "warning: no sha256sum or shasum available — skipping checksum verification"
    return 0
  fi
  [ "$_actual" = "$2" ] || die "checksum mismatch.
  expected $2
  actual   $_actual
Refusing to install. Report this at https://github.com/$REPO/issues"
}

# ── main ────────────────────────────────────────────────────────────────────
TARGET=$(detect_target)
ASSET="janus-$TARGET"

RELEASE=$(release_json)
VERSION=$(json_tag "$RELEASE")
[ -n "$VERSION" ] || die "could not resolve ${JANUS_VERSION:-the latest release}.
If you are being rate-limited by the GitHub API, export GITHUB_TOKEN.
Alternative: npm i -g janus-cli"

BIN_URL=$(asset_url "$RELEASE" "$ASSET")
SUMS_URL=$(asset_url "$RELEASE" "SHA256SUMS")
[ -n "$BIN_URL" ] || die "release $VERSION has no asset named $ASSET.
Available builds are listed at https://github.com/$REPO/releases/tag/$VERSION"

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT INT TERM

say "janus $VERSION  ($TARGET)"

say "  downloading $ASSET"
fetch "$BIN_URL" "$TMP/$BIN_NAME" "application/octet-stream" || die "download failed: $BIN_URL
If you are being rate-limited, export GITHUB_TOKEN. Alternative: npm i -g janus-cli"

say "  verifying checksum"
[ -n "$SUMS_URL" ] || die "release $VERSION has no SHA256SUMS asset — refusing to install an unverified binary"
fetch "$SUMS_URL" "$TMP/SHA256SUMS" "application/octet-stream" || die "could not fetch SHA256SUMS for $VERSION"
EXPECTED=$(grep " $ASSET\$" "$TMP/SHA256SUMS" | cut -d' ' -f1)
[ -n "$EXPECTED" ] || die "$ASSET is not listed in SHA256SUMS"
verify_sha256 "$TMP/$BIN_NAME" "$EXPECTED"

DIR=$(pick_install_dir)
mkdir -p "$DIR" || die "cannot create $DIR"
chmod +x "$TMP/$BIN_NAME"
mv "$TMP/$BIN_NAME" "$DIR/$BIN_NAME" || die "cannot write to $DIR — set JANUS_INSTALL_DIR to somewhere writable"

say "  installed to $DIR/$BIN_NAME"

case ":$PATH:" in
  *":$DIR:"*) ;;
  *) say ""
     say "  $DIR is not on your PATH. Add it:"
     say "    echo 'export PATH=\"$DIR:\$PATH\"' >> ~/.zshrc   # or ~/.bashrc"
     ;;
esac

say ""
"$DIR/$BIN_NAME" --version >&2 || true
say ""
say "  janus --help          what it can do"
say "  janus --list          the techniques and mutators it has"
say ""
say "  Only use it against targets you own or are authorized to test."
