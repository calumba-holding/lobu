# Adding Peerbot to ArtifactHub

## Manual Steps Required

ArtifactHub requires manual addition through their web interface. Follow these steps:

### 1. Sign in to ArtifactHub
- Go to https://artifacthub.io
- Click "Sign in" (top right)
- Use GitHub OAuth to sign in with your account

### 2. Add Repository
- Once signed in, click your profile icon (top right)
- Select "Control Panel"
- Click "Add repository" button
- Fill in the form:
  - **Kind**: Helm charts
  - **Name**: `peerbot`
  - **Display name**: `Peerbot Helm Charts`
  - **URL**: `https://buremba.github.io/helm-charts/`
  - **Description**: Helm charts for Peerbot - AI-powered Slack bot for code assistance
  
### 3. Verify Ownership
The repository already contains `artifacthub-repo.yml` with:
```yaml
repositoryID: 2bad8467-2919-492c-9423-1d3f2750c24b
owners:
  - name: buremba
    email: emre@rakam.io
```

This will automatically verify you as the owner.

### 4. Wait for Indexing
- ArtifactHub will scan the repository every 30 minutes
- The chart should appear in search results within an hour
- Direct link will be: https://artifacthub.io/packages/helm/peerbot/peerbot

## Repository Details

- **Public Helm Repository**: https://github.com/buremba/helm-charts
- **Helm Repo URL**: https://buremba.github.io/helm-charts/
- **Current Chart**: peerbot v1.0.1

## Testing the Repository

```bash
# Add repository
helm repo add peerbot https://buremba.github.io/helm-charts/
helm repo update

# Search for chart
helm search repo peerbot

# Install chart
helm install my-peerbot peerbot/peerbot
```

## API Credentials (Already Configured)

Your API credentials are stored as GitHub secrets:
- `ARTIFACTHUB_API_KEY_ID`: 2bad8467-2919-492c-9423-1d3f2750c24b
- `ARTIFACTHUB_API_KEY_SECRET`: (configured)

These are used by the GitHub Actions workflow to notify ArtifactHub when new versions are published.