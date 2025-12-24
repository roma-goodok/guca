#!/usr/bin/env sh
set -eu

code2prompt \
  --exclude="*.json,*.js,*.exe,*.bin,*.dll,*.map,*.cs,node_modules/**,data/**,code2prompt/templates/**,scripts/**,src/__tests__/**,*.hbs" \
  --tokens "format" --encoding=cl100k \
  -t ./code2prompt/templates/new-features.hbs \
  . ./code2prompt/output.txt

