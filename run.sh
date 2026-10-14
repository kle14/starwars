#!/usr/bin/env bash
eval "$(conda shell.bash hook)"
conda activate starwars-chat

(cd backend && uvicorn main:app --reload --port 8000) &
BACK=$!
trap "kill $BACK" EXIT

cd frontend && npm run dev
