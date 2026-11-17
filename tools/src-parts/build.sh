#!/bin/sh
# Ricompone www/index.html dalle parti sorgente e controlla la sintassi JS.
set -e
cd "$(dirname "$0")"
OUT=../../www
cat p1_head.html p2_core.js p3_world.js p4_game.js p5_ui.js p6_end.html > $OUT/index.html
cat p2_core.js p3_world.js p4_game.js p5_ui.js > /tmp/check.mjs
node --check /tmp/check.mjs && echo SYNTAX_OK
