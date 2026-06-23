#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Configuration
REMOTE_USER="sabrodigan"
REMOTE_HOST="boxtracker.net"
REMOTE_DIR="/home/sabrodigan/boxTracker"
SERVICE_NAME="boxtracker"

echo "========================================"
echo " Deploying BoxTracker to $REMOTE_HOST"
echo "========================================"

# 1. Build the frontend
echo "--> Building the frontend..."
npm run build

# 2. Build the backend for Linux
echo "--> Compiling Go backend for Linux (amd64)..."
GOOS=linux GOARCH=amd64 go build -o server_linux_amd64

# 3. Stop the service and transfer the backend binary
echo "--> Stopping $SERVICE_NAME service on the server..."
ssh -t -o StrictHostKeyChecking=accept-new $REMOTE_USER@$REMOTE_HOST "sudo systemctl stop $SERVICE_NAME" || true

echo "--> Transferring backend binary to server..."
scp -o StrictHostKeyChecking=accept-new server_linux_amd64 $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/server_linux_amd64

# 4. Transfer the frontend files
echo "--> Transferring frontend build to server..."
scp -o StrictHostKeyChecking=accept-new -r dist/public $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/dist/

# 5. Restart the service
echo "--> Restarting $SERVICE_NAME service on the server..."
ssh -t -o StrictHostKeyChecking=accept-new $REMOTE_USER@$REMOTE_HOST "sudo systemctl restart $SERVICE_NAME"

echo "========================================"
echo " Deployment successful!"
echo "========================================"
