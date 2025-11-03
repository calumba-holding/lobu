#!/usr/bin/env node

const https = require("node:https");
const path = require("node:path");

// Load QA credentials to send as PeerQA
// Check if --json is in arguments to suppress dotenv output
const jsonMode = process.argv.includes("--json");
if (!jsonMode) {
  console.log("🔧 Loading test configuration...");
}

// Temporarily redirect console.log for dotenv if in JSON mode
const originalLog = console.log;
if (jsonMode) {
  console.log = () => {
    // Suppressed for JSON mode
  };
}
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
if (jsonMode) {
  console.log = originalLog;
}
const QA_BOT_TOKEN = process.env.QA_SLACK_BOT_TOKEN;
const TARGET_BOT_USERNAME = process.env.QA_TARGET_BOT_USERNAME;
const QA_CHANNEL = process.env.QA_SLACK_CHANNEL || "C0952LTF7DG";

// Validate required environment variables
if (!TARGET_BOT_USERNAME) {
  if (!jsonMode) {
    console.error("❌ QA_TARGET_BOT_USERNAME environment variable is required");
    console.error("Please set QA_TARGET_BOT_USERNAME in your .env file");
  }
  process.exit(1);
}

if (!QA_BOT_TOKEN) {
  if (!jsonMode) {
    console.error("❌ QA_SLACK_BOT_TOKEN environment variable is required");
    console.error("Please set QA_SLACK_BOT_TOKEN in your .env file");
  }
  process.exit(1);
}

async function makeSlackRequest(method, body) {
  return new Promise((resolve, reject) => {
    const needsUrlEncoding = [
      "conversations.info",
      "conversations.history",
      "conversations.replies",
    ].includes(method);
    const postData = needsUrlEncoding
      ? new URLSearchParams(body).toString()
      : JSON.stringify(body);

    const options = {
      hostname: "slack.com",
      port: 443,
      path: `/api/${method}`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${QA_BOT_TOKEN}`,
        "Content-Type": needsUrlEncoding
          ? "application/x-www-form-urlencoded"
          : "application/json",
        "Content-Length": Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          const result = JSON.parse(data);
          if (result.ok) {
            resolve(result);
          } else {
            reject(new Error(`Slack API error: ${result.error}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

async function waitForBotResponse(
  channel,
  messageTs,
  timeout = 45000,
  jsonOutput = false
) {
  if (!jsonOutput) console.log("⏳ Waiting for bot response...");
  const startTime = Date.now();
  let foundResponse = null;

  while (Date.now() - startTime < timeout) {
    try {
      // Check for replies in the thread first (most common case)
      const threadReplies = await makeSlackRequest("conversations.replies", {
        channel: channel,
        ts: messageTs,
        limit: 10,
      });

      if (threadReplies.messages && threadReplies.messages.length > 1) {
        const botMessages = threadReplies.messages
          .slice(1)
          .filter((msg) => msg.bot_id);
        if (botMessages.length > 0) {
          foundResponse = botMessages[0];
          if (!jsonOutput)
            console.log(
              `📱 Found bot response in thread at ${foundResponse.ts}`
            );
          break;
        }
      }

      // Also check main channel as fallback
      const history = await makeSlackRequest("conversations.history", {
        channel: channel,
        oldest: (parseFloat(messageTs) - 5).toString(),
        limit: 20,
      });

      if (history.messages) {
        const recentBotMessages = history.messages.filter(
          (msg) => msg.bot_id && parseFloat(msg.ts) > parseFloat(messageTs)
        );
        if (recentBotMessages.length > 0) {
          foundResponse = recentBotMessages[0];
          if (!jsonOutput)
            console.log(
              `📱 Found bot response in channel at ${foundResponse.ts}`
            );
          break;
        }
      }
    } catch (error) {
      // Continue waiting on API errors
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  return foundResponse;
}

async function uploadFile(filePath, channels, threadTs = null) {
  const fs = require("node:fs");
  const FormData = require("form-data");

  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("channels", channels);
    form.append("file", fs.createReadStream(filePath));
    if (threadTs) {
      form.append("thread_ts", threadTs);
    }

    const options = {
      hostname: "slack.com",
      port: 443,
      path: "/api/files.upload",
      method: "POST",
      headers: {
        Authorization: `Bearer ${QA_BOT_TOKEN}`,
        ...form.getHeaders(),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          const result = JSON.parse(data);
          if (result.ok) {
            resolve(result);
          } else {
            reject(new Error(`Slack API error: ${result.error}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", reject);
    form.pipe(req);
  });
}

async function simulateInteraction(
  channel,
  messageTs,
  optionIndex = 0,
  jsonOutput = false,
  gatewayUrl = process.env.PUBLIC_GATEWAY_URL || "http://localhost:8080"
) {
  if (!jsonOutput) {
    console.log(
      `\n🎯 Triggering interaction selection (option ${optionIndex})...`
    );
  }

  // Get the message with interactions
  const replies = await makeSlackRequest("conversations.replies", {
    channel: channel,
    ts: messageTs,
    limit: 10,
  });

  if (!replies.messages) {
    throw new Error("No messages found in thread");
  }

  // Find the latest bot message with actions
  const messagesWithActions = replies.messages
    .filter((msg) => msg.bot_id && msg.blocks)
    .reverse();

  let actionMessage = null;
  let actionId = null;
  let selectedOption = null;
  let interactionId = null;

  for (const msg of messagesWithActions) {
    for (const block of msg.blocks) {
      if (block.type === "actions" && block.elements) {
        for (const element of block.elements) {
          // Handle radio buttons
          if (element.type === "radio_buttons" && element.options) {
            if (optionIndex < element.options.length) {
              actionMessage = msg;
              actionId = element.action_id;
              selectedOption = element.options[optionIndex];

              // Extract interaction ID from action_id
              // Format: simple_radio_ui_<uuid>
              const match = actionId.match(/simple_radio_(ui_[\w-]+)/);
              if (match) {
                interactionId = match[1];
              }

              if (!jsonOutput) {
                console.log(
                  `   Found radio buttons: ${element.action_id} with ${element.options.length} options`
                );
                console.log(
                  `   Selecting option ${optionIndex}: ${selectedOption.text.text}`
                );
                console.log(`   Interaction ID: ${interactionId}`);
              }
              break;
            }
          }
          // Handle regular buttons
          else if (element.type === "button") {
            actionMessage = msg;
            actionId = element.action_id;

            // Extract interaction ID from action_id
            const match = actionId.match(/(ui_[\w-]+)/);
            if (match) {
              interactionId = match[1];
            }

            if (!jsonOutput) {
              console.log(`   Found button: ${element.action_id}`);
              console.log(`   Interaction ID: ${interactionId}`);
            }
            break;
          }
        }
        if (actionMessage) break;
      }
    }
    if (actionMessage) break;
  }

  if (!actionMessage || !actionId) {
    throw new Error("No interactive elements found in thread");
  }

  if (!interactionId) {
    throw new Error("Could not extract interaction ID from action_id");
  }

  // Trigger the interaction via gateway API
  if (!jsonOutput) {
    console.log(`\n⚡ Triggering interaction via gateway API...`);
    console.log(`   Gateway: ${gatewayUrl}`);
  }

  const responsePayload = {
    interactionId: interactionId,
    answer: selectedOption ? selectedOption.text.text : "clicked",
  };

  const response = await fetch(`${gatewayUrl}/api/interactions/respond`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(responsePayload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gateway API error (${response.status}): ${errorBody}`);
  }

  const result = await response.json();

  if (!jsonOutput) {
    console.log(`   ✅ Interaction triggered successfully!`);
    console.log(`   Response: ${JSON.stringify(result)}`);
  }

  return {
    actionId,
    interactionId,
    selectedValue: selectedOption ? selectedOption.text.text : "clicked",
    messageTs: actionMessage.ts,
    apiResponse: result,
  };
}

async function runTest(testMessage, timeout = 45000, options = {}) {
  const {
    jsonOutput = false,
    threadTs = null,
    noWait = false,
    filePath = null,
    interact = null,
  } = options;
  const quiet = jsonOutput;

  if (!quiet) {
    console.log("🧪 Peerbot Test");
    console.log("📤 Sending as: PeerQA");
    console.log(`🎯 Target: <@${TARGET_BOT_USERNAME}>`);
    console.log("");
  }

  const targetChannel = QA_CHANNEL;
  let messageTs = threadTs;

  try {
    const prompt = testMessage;
    const message = `<@${TARGET_BOT_USERNAME}> ${prompt}`;

    if (!quiet) {
      console.log("📨 Sending test message...");
      if (filePath) {
        console.log(`📎 With file: ${filePath}`);
      }
    }

    let msg;

    if (filePath) {
      // Upload file with message
      const uploadResult = await uploadFile(filePath, targetChannel, threadTs);

      // Send message in the same thread as the file
      const requestBody = {
        channel: targetChannel,
        text: message,
        thread_ts:
          threadTs || uploadResult.file.shares.public[targetChannel][0].ts,
      };

      msg = await makeSlackRequest("chat.postMessage", requestBody);
    } else {
      // Regular message without file
      const requestBody = {
        channel: targetChannel,
        text: message,
      };

      if (threadTs) {
        requestBody.thread_ts = threadTs;
      }

      msg = await makeSlackRequest("chat.postMessage", requestBody);
    }

    messageTs = msg.ts;

    if (!quiet) {
      console.log(`✅ Sent: "${message}"`);
      console.log(`   Timestamp: ${msg.ts}`);
      console.log("");
    }

    if (noWait) {
      if (jsonOutput) {
        console.log(
          JSON.stringify({
            success: true,
            thread_ts: messageTs,
            message_ts: msg.ts,
            channel: targetChannel,
          })
        );
      }
      process.exit(0);
    }

    // Wait a moment for processing to start
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Check for bot response
    const response = await waitForBotResponse(
      targetChannel,
      messageTs,
      timeout,
      jsonOutput
    );

    if (!response) {
      if (!jsonOutput) {
        console.log(`❌ No bot response within ${timeout / 1000} seconds`);
        console.log(
          "\n🔗 Manual check: https://peerbotcommunity.slack.com/archives/" +
            targetChannel
        );
      }
      process.exit(1);
    }

    if (!jsonOutput) {
      console.log("✅ Bot responded!");
      console.log(`   Response: "${response.text?.substring(0, 200)}..."`);
    }

    // Handle interaction if --interact flag is provided
    if (interact !== null) {
      // Wait a bit for interaction message to be posted (they're often async)
      if (!jsonOutput) {
        console.log("\n⏳ Waiting for interaction elements to load...");
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));

      try {
        const interactionInfo = await simulateInteraction(
          targetChannel,
          messageTs,
          parseInt(interact, 10),
          jsonOutput
        );

        if (!jsonOutput) {
          console.log("\n✅ Interaction triggered!");
          console.log(`   Interaction ID: ${interactionInfo.interactionId}`);
          console.log(`   Action ID: ${interactionInfo.actionId}`);
          console.log(`   Selected value: ${interactionInfo.selectedValue}`);
          console.log("\n⏳ Waiting for bot to process response...");
        }

        // Wait for the bot to process the interaction and respond
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Check for final bot response after interaction
        const finalResponse = await waitForBotResponse(
          targetChannel,
          messageTs,
          timeout,
          jsonOutput
        );

        if (!jsonOutput) {
          if (finalResponse?.text) {
            console.log("\n✅ Bot completed after interaction!");
            console.log(
              `   Final response: "${finalResponse.text.substring(0, 200)}..."`
            );
          }
          console.log("\n🎉 Full E2E interaction test PASSED!");
        }

        if (jsonOutput) {
          console.log(
            JSON.stringify(
              {
                success: true,
                channel: targetChannel,
                thread_ts: messageTs,
                response: {
                  text: response.text,
                  timestamp: response.ts,
                  bot_id: response.bot_id,
                },
                interaction: {
                  interactionId: interactionInfo.interactionId,
                  actionId: interactionInfo.actionId,
                  selectedValue: interactionInfo.selectedValue,
                  triggered: true,
                },
                finalResponse: finalResponse
                  ? {
                      text: finalResponse.text,
                      timestamp: finalResponse.ts,
                    }
                  : null,
                url: `https://peerbotcommunity.slack.com/archives/${targetChannel}`,
              },
              null,
              2
            )
          );
        }
      } catch (interactionError) {
        if (!jsonOutput) {
          console.log(`\n⚠️  Interaction error: ${interactionError.message}`);
        }
      }
    } else {
      if (!jsonOutput) {
        console.log("\n🎉 Test PASSED!");
      }
    }

    if (jsonOutput && interact === null) {
      console.log(
        JSON.stringify(
          {
            success: true,
            channel: targetChannel,
            thread_ts: messageTs,
            response: {
              text: response.text,
              timestamp: response.ts,
              bot_id: response.bot_id,
            },
            url: `https://peerbotcommunity.slack.com/archives/${targetChannel}`,
          },
          null,
          2
        )
      );
    }

    if (!jsonOutput && interact === null) {
      console.log(
        `\n🔗 Channel: https://peerbotcommunity.slack.com/archives/${targetChannel}`
      );
    }

    process.exit(0);
  } catch (error) {
    if (jsonOutput) {
      console.log(
        JSON.stringify({ success: false, error: error.message }, null, 2)
      );
    } else {
      console.error(`❌ Test failed: ${error.message}`);
    }
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
let message = null;
let timeout = 45000;
let jsonOutput = false;
let threadTs = null;
let noWait = false;
let filePath = null;
let interact = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--timeout") {
    if (!args[i + 1]) {
      console.error(`❌ Error: --timeout requires a value`);
      process.exit(1);
    }
    timeout = parseInt(args[i + 1], 10) * 1000;
    i++; // Skip next arg
  } else if (args[i] === "--json") {
    jsonOutput = true;
  } else if (args[i] === "--no-wait") {
    noWait = true;
  } else if (args[i] === "--file") {
    if (!args[i + 1]) {
      console.error(`❌ Error: --file requires a file path`);
      process.exit(1);
    }
    filePath = args[i + 1];
    i++; // Skip next arg
  } else if (args[i] === "--thread-ts") {
    if (!args[i + 1]) {
      console.error(`❌ Error: --thread-ts requires a value`);
      process.exit(1);
    }
    threadTs = args[i + 1];
    i++; // Skip next arg
  } else if (args[i] === "--interact") {
    if (!args[i + 1]) {
      console.error(
        `❌ Error: --interact requires an option index (0, 1, 2, etc.)`
      );
      process.exit(1);
    }
    interact = args[i + 1];
    i++; // Skip next arg
  } else if (args[i] === "--help" || args[i] === "-h") {
    console.log("Usage: ./scripts/slack-qa-bot.js [options] [message]");
    console.log("");
    console.log("Options:");
    console.log(
      "  --timeout <seconds>    Set timeout for bot response (default: 45)"
    );
    console.log("  --json                 Output JSON format");
    console.log("  --thread-ts <ts>       Post to existing thread");
    console.log("  --no-wait              Send message and exit immediately");
    console.log(
      "  --interact <index>     Detect and report interaction info (0=first option, 1=second, etc.)"
    );
    console.log("  --file <path>          Upload a file with the message");
    console.log("  --help, -h             Show this help message");
    console.log("");
    console.log("Examples:");
    console.log('  ./scripts/slack-qa-bot.js "Hello bot"');
    console.log('  ./scripts/slack-qa-bot.js --json "Create a function"');
    console.log(
      '  ./scripts/slack-qa-bot.js --interact 0 "ask me some questions"'
    );
    console.log(
      '  ./scripts/slack-qa-bot.js --interact 2 --timeout 30 "pick something"'
    );
    process.exit(0);
  } else if (args[i].startsWith("--") || args[i].startsWith("-")) {
    // Unrecognized option
    console.error(`❌ Error: Unrecognized option: ${args[i]}`);
    console.error("Use --help for available options");
    process.exit(1);
  } else {
    // This should be the message
    if (message !== null) {
      console.error(
        `❌ Error: Multiple messages not supported. Already have: "${message}", got: "${args[i]}"`
      );
      process.exit(1);
    }
    message = args[i];
  }
}

if (message) {
  runTest(message, timeout, {
    jsonOutput,
    threadTs,
    noWait,
    filePath,
    interact,
  });
} else {
  runTest("Hello bot - simple test", timeout, { jsonOutput });
}
