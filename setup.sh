#!/bin/bash
set -e

echo "Setting up Nonce Lens project..."

# --- Setup Backend ---
echo "Setting up backend..."
cd backend
echo "Creating virtual environment with uv..."
uv venv
echo "Activating virtual environment..."
source .venv/bin/activate
echo "Installing Python dependencies with uv..."
uv sync

# --- Setup Frontend ---
echo "Setting up frontend..."
cd ../frontend
echo "Installing npm dependencies..."
npm install

echo "Setup complete! 🎉"
echo "To start the backend: cd backend && uv run start_server.py"
echo "To start the frontend: cd frontend && npm run dev"
