# CLAUDE.md

- You MUST only do what has been asked; nothing more, nothing less. 
- You can check logs with docker to understand the recent behavior the user is asking for.
- Anytime you make changes in the code, you MUST:
1. Have the bot running via `make dev` running in the background for development that uses hot reload. If there is `peerbot.log` file in the project root, you can skip this step.
2. Run ./test-bot.js "Relevant prompt" --timeout [based on complexity change by default 10] and make sure it works properly. If the script fails (including getting stuck at "Starting environment setup"), you MUST fix it.
2. Read the logs from `peerbot.log` to make sure it works properly.
- If you create ephemeral files, you MUST delete them when you're done with them.
- Use Docker to build and run the Slack bot in development mode, K8S for production.
- NEVER create files unless they're absolutely necessary for achieving your goal. Instead try to run the code on the fly for testing reasons.
- NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User. If you need to remember something, add it to CLAUDE.md as a a single sentence.

## Deployment Instructions

When making changes to the Slack bot:
2. **Docker images**: Make sure dev command is running in the background. Hot reload is enabled.
3. **Kubernetes deployment**: Apply changes with kubectl or restart deployments

## Development Configuration

- Rate limiting is disabled in local development
- To manually rebuild worker image if needed: `docker build -f Dockerfile.worker -t claude-worker:latest .`

## k3s Setup

For k3s clusters, you can install cri-dockerd and configure k3s to use Docker daemon for local images.

## Persistent Storage

Worker pods now use persistent volumes for data storage:

1. **Persistent Volumes**: Each worker pod mounts a persistent volume at `/workspace` to preserve data across pod restarts
2. **Auto-Resume**: The worker automatically resumes conversations using Claude CLI's built-in `--resume` functionality when continuing a thread in the same persistent volume
3. **Data Persistence**: All workspace data is preserved in the persistent volume, eliminating the need for conversation file syncing
   