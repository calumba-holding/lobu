#!/usr/bin/env node

const https = require('https');
const path = require('path');

// Load QA credentials to send as PeerQA
// Check if --json or --quiet is in arguments to suppress dotenv output
const quietMode = process.argv.includes('--json') || process.argv.includes('--quiet') || process.argv.includes('-q');
if (!quietMode) {
  console.log('🔧 Loading test configuration...');
}

// Temporarily redirect console.log for dotenv if in quiet mode
const originalLog = console.log;
if (quietMode) {
  console.log = () => {};
}
require('dotenv').config({ path: path.join(__dirname, '.env') });
if (quietMode) {
  console.log = originalLog;
}
const QA_BOT_TOKEN = process.env.QA_SLACK_BOT_TOKEN;
const TARGET_BOT_USERNAME = process.env.QA_TARGET_BOT_USERNAME;

// Validate required environment variables
if (!TARGET_BOT_USERNAME) {
  console.error('❌ QA_TARGET_BOT_USERNAME environment variable is required');
  console.error('Please set QA_TARGET_BOT_USERNAME in your .env file');
  process.exit(1);
}

if (!QA_BOT_TOKEN) {
  console.error('❌ QA_SLACK_BOT_TOKEN environment variable is required');
  console.error('Please set QA_SLACK_BOT_TOKEN in your .env file');
  process.exit(1);
}

async function makeSlackRequest(method, body) {
  return new Promise((resolve, reject) => {
    const needsUrlEncoding = ['conversations.info', 'conversations.history'].includes(method);
    const postData = needsUrlEncoding 
      ? new URLSearchParams(body).toString()
      : JSON.stringify(body);
    
    const options = {
      hostname: 'slack.com',
      port: 443,
      path: `/api/${method}`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${QA_BOT_TOKEN}`,
        'Content-Type': needsUrlEncoding ? 'application/x-www-form-urlencoded' : 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
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

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function waitForBotResponse(channel, afterTimestamp, timeout = 30000, quiet = false) {
  if (!quiet) console.log('⏳ Waiting for bot response...');
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const history = await makeSlackRequest('conversations.history', {
        channel: channel,
        oldest: afterTimestamp,
        limit: 10
      });
      
      // Look for bot messages (any message with bot_id)
      const botMessages = history.messages.filter(msg => msg.bot_id);
      
      if (botMessages.length > 0) {
        return botMessages;
      }
    } catch (error) {
      // Ignore rate limit errors and continue waiting
    }
    
    // Wait 2 seconds before checking again
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  return null;
}

async function checkForAnyReaction(channel, timestamp, timeout = 10000, quiet = false) {
  if (!quiet) console.log('⏳ Checking for any reaction (cog=processing, checkmark=success)...');
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const result = await makeSlackRequest('reactions.get', {
        channel: channel,
        timestamp: timestamp
      });
      
      if (result.message && result.message.reactions) {
        const eyesReaction = result.message.reactions.find(r => r.name === 'eyes');
        const cogReaction = result.message.reactions.find(r => r.name === 'gear');
        const checkmarkReaction = result.message.reactions.find(r => r.name === 'white_check_mark');
        
        if (checkmarkReaction) {
          return 'success';
        } else if (cogReaction) {
          return 'processing';
        } else if (eyesReaction) {
          return 'processing'; // Eyes indicates bot acknowledged and is starting to process
        }
      }
    } catch (error) {
      // Message might not exist yet or no reactions
    }
    
    // Wait 1 second before checking again for initial reaction
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return 'none';
}

async function waitForSuccessReaction(channel, timestamp, timeout = 30000, quiet = false) {
  if (!quiet) console.log('⏳ Waiting for success reaction (white_check_mark)...');
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const result = await makeSlackRequest('reactions.get', {
        channel: channel,
        timestamp: timestamp
      });
      
      if (result.message && result.message.reactions) {
        const checkmarkReaction = result.message.reactions.find(r => r.name === 'white_check_mark');
        if (checkmarkReaction) {
          return true;
        }
      }
    } catch (error) {
      // Message might not exist yet or no reactions
    }
    
    // Wait 2 seconds before checking again
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  return false;
}

async function evaluateTestResult(channel, messageTs, timeout, testType = 'Test', options = {}) {
  const { quiet = false, waitForResponse = false } = options;
  
  // First, check for any reaction within 10 seconds
  const initialReaction = await checkForAnyReaction(channel, messageTs, 10000, quiet);
  
  if (initialReaction === 'none') {
    if (!quiet) {
      console.log('❌ No reaction from bot within 10 seconds - bot failed to acknowledge the message');
      console.log('\nTroubleshooting steps:');
      console.log('1. Check dispatcher logs for incoming events: kubectl logs -n peerbot -l app.kubernetes.io/component=dispatcher --tail=50');
      console.log('2. Verify dispatcher is receiving Slack events: kubectl logs -n peerbot -l app.kubernetes.io/component=dispatcher --tail=50 | grep "mention"');
      console.log('3. Check if message is queued: kubectl logs -n peerbot -l app.kubernetes.io/component=dispatcher --tail=50 | grep "Enqueuing"');
      console.log('4. Check orchestrator for scaling issues: kubectl logs -n peerbot -l app.kubernetes.io/component=orchestrator --tail=50');
      console.log('5. Verify worker pods exist: kubectl get pods -n peerbot | grep claude-worker');
      console.log('6. Check PostgreSQL connection: kubectl exec -it -n peerbot deployment/peerbot-dispatcher -- nc -zv postgres-service 5432');
      console.log('7. Restart all components if needed: kubectl rollout restart deployment -n peerbot');
    }
    return { success: false, error: 'No acknowledgment from bot' };
  } else if (initialReaction === 'success') {
    if (!quiet) console.log('✅ Bot immediately processed message (checkmark reaction)');
  } else if (initialReaction === 'processing') {
    if (!quiet) console.log('⚙️ Bot started processing (cog reaction detected)');
    
    // Wait for success reaction
    const hasSuccess = await waitForSuccessReaction(channel, messageTs, timeout, quiet);
    
    if (!hasSuccess) {
      if (!quiet) {
        console.log('❌ Bot started processing but never completed (no checkmark reaction)');
        console.log('\nTroubleshooting steps:');
        console.log('1. Check worker pod status: kubectl get pods -n peerbot | grep claude-worker');
        console.log('2. Check worker logs for errors: kubectl logs -n peerbot -l app.kubernetes.io/component=claude-worker --tail=100');
        console.log('3. Check if worker has sufficient resources: kubectl describe pod -n peerbot -l app.kubernetes.io/component=claude-worker');
        console.log('4. Check queue for stuck messages: kubectl logs -n peerbot -l app.kubernetes.io/component=dispatcher --tail=50 | grep "queue"');
        console.log('5. Restart worker pods if necessary: kubectl rollout restart deployment/peerbot-claude-worker -n peerbot');
        console.log('6. Check orchestrator logs: kubectl logs -n peerbot -l app.kubernetes.io/component=orchestrator --tail=50');
        console.log('7. Verify PostgreSQL queue is accessible: kubectl exec -it -n peerbot deployment/peerbot-dispatcher -- nc -zv postgres-service 5432');
      }
      return { success: false, error: 'Bot processing incomplete' };
    } else {
      if (!quiet) console.log('✅ Bot completed processing (checkmark reaction added)');
    }
  }
  
  // At this point, we know the bot processed the message (has checkmark)
  // Always wait for response messages to include in result
  let response = await waitForBotResponse(channel, messageTs, timeout, quiet);
  
  // For JSON mode, still wait for response even if not explicitly requested
  if (!waitForResponse && !response) {
    response = await waitForBotResponse(channel, messageTs, Math.min(timeout, 10000), true); // Quick check for JSON mode
  }
  
  // Check for "Starting environment setup" stuck state
  const isStuckInSetup = response && response.length > 0 && 
    response[0].text && response[0].text.includes('Starting environment setup') &&
    response.length === 1 && !response[0].text.includes('✅');
  
  if (isStuckInSetup) {
    console.log('❌ Bot is stuck in "Starting environment setup" message');
    console.log('\n⚠️ Bot appears to be stuck during initialization');
    console.log('\nTroubleshooting steps:');
    console.log('1. Check worker pod status: kubectl get pods -n peerbot | grep claude-worker');
    console.log('2. Check worker logs for errors: kubectl logs -n peerbot -l app.kubernetes.io/component=claude-worker --tail=100');
    console.log('3. Check if worker has sufficient resources: kubectl describe pod -n peerbot -l app.kubernetes.io/component=claude-worker');
    console.log('4. Check queue for stuck messages: kubectl logs -n peerbot -l app.kubernetes.io/component=dispatcher --tail=50 | grep "queue"');
    console.log('5. Restart worker pods if necessary: kubectl rollout restart deployment/peerbot-claude-worker -n peerbot');
    console.log('6. Check orchestrator logs: kubectl logs -n peerbot -l app.kubernetes.io/component=orchestrator --tail=50');
    console.log('7. Verify PostgreSQL queue is accessible: kubectl exec -it -n peerbot deployment/peerbot-dispatcher -- nc -zv postgres-service 5432');
    process.exit(1);
  }
  
  if (response && response.length > 0) {
    if (!quiet) {
      console.log(`✅ Bot responded with message!`);
      console.log(`   Response: "${response[0].text?.substring(0, 200)}..."`);
      
      // Check if response has blocks (for blockkit)
      if (response[0].blocks && response[0].blocks.length > 0) {
        console.log(`   Blocks: ${response[0].blocks.length} blocks found`);
        const actionBlocks = response[0].blocks.filter(b => b.type === 'actions');
        if (actionBlocks.length > 0) {
          console.log(`   ✨ Found ${actionBlocks.length} action block(s) with buttons!`);
        }
      }
      
      console.log(`\n🎉 ${testType} PASSED!`);
    }
    return { success: true, response: response[0] };
  } else {
    if (!quiet) {
      console.log('⚠️ Bot processed message but no response was sent');
      console.log(`\n⚠️ ${testType} PARTIALLY PASSED - Consider this a failure for automation purposes`);
    }
    return { success: false, error: 'No response from bot' };
  }
}

async function runTest(messages, timeout = 30000, options = {}) {
  const { jsonOutput = false, waitForResponse = false, quiet = false, threadTs = null } = options;
  const isSingleMessage = messages.length === 1;
  const testType = isSingleMessage ? 'Test' : 'Multi-Message Test';
  
  if (!quiet) {
    console.log(`🧪 Peerbot ${testType}`);
    console.log('📤 Sending as: PeerQA');
    console.log(`🎯 Target: <@${TARGET_BOT_USERNAME}>`);
    if (!isSingleMessage) {
      console.log(`📝 Messages: ${messages.length}`);
    }
    console.log('');
  }
  
  const targetChannel = 'C0952LTF7DG'; // #peerbot-qa
  let firstMessageTs = threadTs; // Use provided thread or null for new thread
  
  try {
    for (let i = 0; i < messages.length; i++) {
      const prompt = messages[i];
      const isFirstMessage = i === 0;
      const message = `<@${TARGET_BOT_USERNAME}> ${prompt}`;
      
      if (!quiet) {
        if (messages.length > 1) {
          console.log(`📨 Sending message ${i + 1}/${messages.length}${isFirstMessage ? ' (initial)' : ' (thread)'}...`);
        } else {
          console.log('📨 Sending test message...');
        }
      }
      
      const requestBody = {
        channel: targetChannel,
        text: message
      };
      
      // If thread_ts is provided, always use it (even for first message)
      // Otherwise, if not the first message, send in thread
      if (threadTs) {
        requestBody.thread_ts = threadTs;
      } else if (!isFirstMessage && firstMessageTs) {
        requestBody.thread_ts = firstMessageTs;
      }
      
      const msg = await makeSlackRequest('chat.postMessage', requestBody);
      
      // Store timestamp if this is the first message and no thread was provided
      if (isFirstMessage && !threadTs) {
        firstMessageTs = msg.ts;
      }
      
      if (!quiet) {
        console.log(`✅ Sent: "${message}"`);
        console.log(`   Timestamp: ${msg.ts}`);
        if (threadTs) {
          console.log(`   Added to existing thread: ${threadTs}`);
        } else if (messages.length > 1) {
          console.log(`   ${isFirstMessage ? 'Thread started' : 'Added to thread'}`);
        }
        console.log('');
      }
      
      // Wait a bit between messages
      if (i < messages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Wait a bit for the bot to start processing
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Evaluate test result - use the message timestamp if posting to existing thread
    const messageToCheck = threadTs ? threadTs : firstMessageTs;
    const result = await evaluateTestResult(targetChannel, messageToCheck, timeout, testType, { quiet, waitForResponse });
    
    if (jsonOutput) {
      // Output JSON result
      const output = {
        success: result.success,
        channel: targetChannel,
        thread_ts: threadTs || firstMessageTs,
        messages_sent: messages.length,
        ...(threadTs && { posted_to_thread: threadTs }),
        ...(result.error && { error: result.error }),
        ...(result.response && { 
          response: {
            text: result.response.text,
            timestamp: result.response.ts,
            ...(result.response.blocks && { blocks: result.response.blocks }),
            ...(result.response.bot_id && { bot_id: result.response.bot_id })
          }
        }),
        url: `https://peerbotcommunity.slack.com/archives/${targetChannel}`
      };
      console.log(JSON.stringify(output, null, 2));
    } else if (!quiet) {
      console.log('\n🔗 Channel: https://peerbotcommunity.slack.com/archives/C0952LTF7DG');
    }
    
    // Exit with proper code
    process.exit(result.success ? 0 : 1);
    
  } catch (error) {
    if (jsonOutput) {
      console.log(JSON.stringify({ success: false, error: error.message }, null, 2));
    } else if (!quiet) {
      console.error(`❌ ${testType} failed:`, error.message);
    }
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
let messages = [];
let timeout = 30000; // default 30 seconds
let jsonOutput = false;
let waitForResponse = false;
let quiet = false;
let threadTs = null; // Thread timestamp to post to

// Parse options
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--timeout' && args[i + 1]) {
    timeout = parseInt(args[i + 1]) * 1000; // convert seconds to milliseconds
    args.splice(i, 2); // remove --timeout and its value
    i--;
  } else if (args[i] === '--json') {
    jsonOutput = true;
    quiet = true; // JSON mode implies quiet
    args.splice(i, 1);
    i--;
  } else if (args[i] === '--wait-for-response') {
    waitForResponse = true;
    args.splice(i, 1);
    i--;
  } else if (args[i] === '--thread-ts' && args[i + 1]) {
    threadTs = args[i + 1];
    args.splice(i, 2);
    i--;
  } else if (args[i] === '--quiet' || args[i] === '-q') {
    quiet = true;
    args.splice(i, 1);
    i--;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log('Usage: slack-qa-bot.js [options] [message1] [message2] ...');
    console.log('');
    console.log('Options:');
    console.log('  --timeout <seconds>    Set timeout for bot response (default: 30)');
    console.log('  --json                 Output JSON format (implies --quiet)');
    console.log('  --wait-for-response    Wait for bot to fully respond before exiting');
    console.log('  --thread-ts <ts>       Post to existing thread by timestamp');
    console.log('  --quiet, -q            Suppress non-essential output');
    console.log('  --help, -h             Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  # Simple test');
    console.log('  ./slack-qa-bot.js "Hello bot"');
    console.log('');
    console.log('  # JSON output for chaining');
    console.log('  ./slack-qa-bot.js --json "Create a function" | jq -r .thread_ts');
    console.log('');
    console.log('  # Multi-message in thread');
    console.log('  ./slack-qa-bot.js "Start task" "Add more details" "Complete it"');
    console.log('');
    console.log('  # Wait for full response with timeout');
    console.log('  ./slack-qa-bot.js --wait-for-response --timeout 60 "Complex task"');
    console.log('');
    console.log('  # Continue existing thread');
    console.log('  THREAD=$(./slack-qa-bot.js --json "Start task" | jq -r .thread_ts)');
    console.log('  ./slack-qa-bot.js --thread-ts $THREAD "Continue in same thread"');
    process.exit(0);
  }
}

// Remaining args are messages
messages = args.filter(arg => arg.trim().length > 0);

if (messages.length > 0) {
  runTest(messages, timeout, { jsonOutput, waitForResponse, quiet, threadTs });
} else {
  // Run default tests
  runTest(['Create me a new project for my landing page of a Pet Store? It\' is a fictionary app so be creating don\'t ask me. Project name is "Pet Store {timestamp}"'], timeout, { jsonOutput, waitForResponse, quiet });
  runTest(['Create a button to add a new pet to the pet store'], timeout, { jsonOutput, waitForResponse, quiet });
  runTest(["Create 5 tasks which will each return a random number and then you will sum all them."], timeout, { jsonOutput, waitForResponse, quiet });
}