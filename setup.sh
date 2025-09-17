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
echo "To start the backend, run the following commands from the project root:"
echo "  cd backend"
echo "  uv run start_server.py"
echo "NOTE: The backend server must be started from the 'backend' directory."
echo "To start the frontend: cd frontend && npm run dev"
