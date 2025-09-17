# Backend

This directory contains the Python FastAPI backend for the Stake Bet Analyzer.

## Database

The application uses a SQLite database file named `pump.db` which is located in this `backend` directory. All application data, including runs and live streams, is stored in this file.

**Important:** The server must be started from within the `backend` directory for the application to find the database.
