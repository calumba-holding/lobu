#!/bin/bash

# Comprehensive E2E test for Slack bot
set -e

echo "🧪 Running comprehensive E2E tests for Slack bot..."
echo ""

# Test 1: Basic JSON response format
echo "📝 Test 1: Basic JSON response format"
echo "Command: ./slack-qa-bot.js --json \"Calculate 7+3\""
echo ""

response=$(./slack-qa-bot.js --json "Calculate 7+3")
echo "Response:"
echo "$response" | jq '.'
echo ""

# Extract thread_ts for next test
thread_ts=$(echo "$response" | jq -r '.thread_ts')
echo "🔗 Extracted thread_ts: $thread_ts"
echo ""

# Test 2: Thread continuation
echo "📝 Test 2: Thread continuation with --thread-ts"
echo "Command: ./slack-qa-bot.js --json --thread-ts \"$thread_ts\" \"Now multiply that result by 2\""
echo ""

response2=$(./slack-qa-bot.js --json --thread-ts "$thread_ts" "Now multiply that result by 2")
echo "Response:"
echo "$response2" | jq '.'
echo ""

# Test 3: File creation test
echo "📝 Test 3: File creation test"
echo "Command: ./slack-qa-bot.js \"Create a simple Python hello world script\" --timeout 30"
echo ""

./slack-qa-bot.js "Create a simple Python hello world script" --timeout 30

echo ""
echo "✅ All E2E tests completed!"
echo ""
echo "Note: Check the Slack channel for actual responses and file creation."