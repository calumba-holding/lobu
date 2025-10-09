# Peerbot

Peerbot lets you create your own AI agents with Claude Code and turn them into Slack bots.

## Installation

- Run `npx peerbot setup` to generate `.env` file
- Run `npx peerbot dev` to start the application

## 🎯 Key Features

### 💬 **Thread-Based Persistent Conversations**

- Each Slack thread becomes a dedicated AI coding session
- Full conversation history preserved across interactions
- Resume work exactly where you left off


## Development

-- If you need to run QA tests (`./slack-qa-bot.js`), add these variables to your `.env` file:

```
QA_SLACK_BOT_TOKEN=your_qa_bot_token_here
QA_TARGET_BOT_USERNAME=your_target_bot_username_here
```