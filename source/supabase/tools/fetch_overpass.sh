#!/bin/sh
# 岡山市北区・中心部の飲食店を Overpass API から取得して overpass.json に保存する。
# Overpass は User-Agent と Accept ヘッダが無いと 406 を返す。範囲は ../../overpass-okayama.md を参照。
cd "$(dirname "$0")" || exit 1
curl -s -m 90 -A "imakuite-inspector/1.0 (https://github.com/kambanoro2685-dot/imakuite-inspector)" \
  -H "Accept: application/json" -X POST https://overpass-api.de/api/interpreter \
  --data-urlencode 'data=[out:json][timeout:60];(node["amenity"~"^(restaurant|cafe|fast_food|bar|pub|food_court|ice_cream)$"](34.648,133.905,34.678,133.940);way["amenity"~"^(restaurant|cafe|fast_food|bar|pub|food_court|ice_cream)$"](34.648,133.905,34.678,133.940););out center tags;' \
  -o overpass.json
