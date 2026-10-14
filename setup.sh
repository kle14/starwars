#!/usr/bin/env bash
set -e

mkdir -p backend

# 1) create (or update) the conda env
if conda env list | grep -q "^starwars-chat "; then
  conda env update -n starwars-chat -f environment.yml --prune
else
  conda env create -f environment.yml
fi

# 2) scaffold the React frontend inside the env
if [ ! -d frontend ]; then
  conda run -n starwars-chat --no-capture-output \
    npm create vite@latest frontend -- --template react
fi

# 3) install frontend deps
conda run -n starwars-chat --no-capture-output npm --prefix frontend install

echo "Done. Now:"
echo "  1) paste backend/main.py, frontend/src/App.jsx, frontend/src/App.css"
echo "  2) add the Orbitron <link> to frontend/index.html"
echo "  3) run ./run.sh"
