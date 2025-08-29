# Peerbot

A powerful [Claude Code](https://claude.ai/code) Slack application that brings AI-powered programming assistance directly to your Slack workspace with **Kubernetes-based scaling** and **persistent thread conversations**.

## Installation

- Install [Docker](https://docker.com/)
- Install [Kubernetes K3S](https://k3s.io/)
- Install [Postgresql >16](https://www.postgresql.org/download/linux/ubuntu/)
- Run `make setup` to generate `.env` file
- Run `mave dev`

-- If you need to run QA tests (`./test-bot.js`), add these variables to your `.env` file:

```
QA_SLACK_BOT_TOKEN=your_qa_bot_token_here
QA_TARGET_BOT_USERNAME=your_target_bot_username_here
```


## 🎯 Key Features

### 💬 **Thread-Based Persistent Conversations**
- Each Slack thread becomes a dedicated AI coding session
- Full conversation history preserved across interactions
- Resume work exactly where you left off

### 🏗️ **Kubernetes-Powered Architecture**
- **Dispatcher-Worker Pattern**: Scalable, isolated execution
- **Per-User Containers**: Each session gets dedicated resources
- **5-Minute Sessions**: Focused, efficient coding sessions
- **Auto-Scaling**: Handles multiple users simultaneously

### 👤 **Individual GitHub Workspaces**  
- **Personal Repositories**: Each user gets `user-{username}` repository
- **Automatic Git Operations**: Code commits and branch management
- **GitHub.dev Integration**: Direct links to online code editor
- **Pull Request Creation**: Easy code review workflow

### 🔄 **Real-Time Progress Streaming**
- Live updates as Claude works on your code
- Worker resource monitoring (CPU, memory, timeout)
- Transparent execution with detailed progress logs

## 🚀 Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Dispatcher    │    │   Worker Jobs   │    │  GitHub         │
│   (Long-lived)  │───▶│   (Ephemeral)   │───▶│  (Persistence)  │
│                 │    │                 │    │                 │
│ • Slack Events  │    │ • User Workspace│    │ • Data on Slack │
│ • Thread Routing│    │ • Claude CLI    │    │ • Code Changes  │
│ • Job Spawning  │    │ • 5min Timeout  │    │ • Session Data  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📋 Deployment Options

Choose your deployment approach:

### 🎯 **Option 1: Kubernetes (Recommended)**
Full-featured deployment with per-user isolation and persistence

**Benefits:**
- ✅ Per-user containers and GitHub repositories  
- ✅ Thread-based conversation persistence via Kubernetes PVC
- ✅ Horizontal scaling for large teams
- ✅ Enterprise security and monitoring
- ✅ Persistent volume-based session storage

**Prerequisites:**
- Kubernetes cluster (GKE, EKS, AKS, or local)
- GitHub organization for user repositories

### 🐳 **Option 2: Docker (Development)**
Simplified deployment using Docker containers with local workspace persistence

**Benefits:**
- ✅ Quick local development setup
- ✅ Thread-based conversation persistence via local volumes
- ✅ Per-user containers with isolated workspaces
- ✅ Hot reload support for development
- ✅ Direct filesystem access for debugging

**How Docker Deployment Works:**
1. **Orchestrator** receives Slack events and creates Docker containers dynamically
2. **Per-Thread Containers**: Each Slack conversation thread spawns a dedicated `peerbot-worker-{threadId}` container
3. **Local Volume Mounting**: Host directory `./workspaces/{userId}/{threadId}/` is mounted to container's `/workspace`
4. **Environment Variables**: Common configuration centralized in `BaseDeploymentManager.generateEnvironmentVariables()`
5. **Resource Limits**: Docker containers respect CPU/memory limits similar to Kubernetes pods
6. **Auto-Cleanup**: Idle containers are automatically stopped and removed after timeout

**Container Lifecycle:**
```bash
# Container creation
docker run --name peerbot-worker-1756492073.980799 \
  -v ./workspaces/U095ZLHKP98/1756492073.980799:/workspace \
  -e DATABASE_URL=postgresql://user:pass@host.docker.internal:5432/db \
  -e USER_ID=U095ZLHKP98 \
  -e SLACK_THREAD_TS=1756492073.980799 \
  claude-worker:latest

# Automatic scaling to 0 (stop)
docker stop peerbot-worker-1756492073.980799

# Cleanup (remove)
docker rm peerbot-worker-1756492073.980799
```

**Prerequisites:**
- Docker installed and running
- PostgreSQL database accessible via `host.docker.internal` (macOS/Windows) or `localhost` (Linux)