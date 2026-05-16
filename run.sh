#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
pkill -f "python.*main.py" 2>/dev/null
sleep 0.5
exec ~/pidm-venv/bin/python "$DIR/main.py" "$@"
