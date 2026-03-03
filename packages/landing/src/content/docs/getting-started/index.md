---
title: Getting Started
description: Choose between managed community access and self-hosted deployment.
---

Lobu deploys sandboxed OpenClaw agents on demand for every user and channel.

## Managed (Community)

[![Add to Slack](https://img.shields.io/badge/Add_to_Slack-4A154B?style=for-the-badge&logo=slack&logoColor=white)](https://community.lobu.ai/slack/install)
[![Join Community](https://img.shields.io/badge/Join_Community-4A154B?style=for-the-badge&logo=slack&logoColor=white)](https://join.slack.com/t/peerbot/shared_invite/zt-391o8tyw2-iyupjTG1xHIz9Og8C7JOnw)
[![Try @lobuaibot](https://img.shields.io/badge/Try_@lobuaibot-26A5E4?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/lobuaibot)

Managed access is currently free.

Notes:

- Pricing will be based on compute machine usage in the future.
- LLM keys belong to you (bring your own provider keys).
- OpenClaw workers scale to zero when idle and wake when you send a message.

## Self-hosted

Self-hosted gives you full control of infrastructure and runtime policy.

Main differences from managed:

- You run the infrastructure (Docker or Kubernetes).
- You manage ops, networking policy, and upgrades.
- You pay infra costs directly in your own environment.

Choose a deployment guide:

- [Docker Deployment](/deployment/docker/)
- [Kubernetes Deployment](/deployment/kubernetes/)
