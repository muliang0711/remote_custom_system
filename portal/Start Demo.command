#!/bin/zsh
cd -- "${0:A:h}"
if [[ ! -d node_modules ]]; then
  npm install || exit 1
fi
if [[ ! -f .next/BUILD_ID ]]; then
  npm run demo:build || exit 1
fi
print 'Jymmanuel demo: http://127.0.0.1:3000'
npm run demo:start
