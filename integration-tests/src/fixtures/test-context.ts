import { MockClaudeServer } from "../mocks/claude-server";
import { MockSlackServer } from "../mocks/slack-server";

export class TestContext {
  public slackServer: MockSlackServer;
  public claudeServer: MockClaudeServer;

  constructor() {
    this.slackServer = new MockSlackServer(4001);
    this.claudeServer = new MockClaudeServer(8081);
  }

  async setup() {
    // Start mock servers
    await this.slackServer.start();
    await this.claudeServer.start();

    console.log("Test context setup complete");
  }

  async teardown() {
    await this.slackServer.stop();
    await this.claudeServer.stop();
  }

  // Helper to wait for a condition
  async waitFor(
    condition: () => Promise<boolean> | boolean,
    options = { timeout: 5000, interval: 100 }
  ): Promise<void> {
    const start = Date.now();

    while (Date.now() - start < options.timeout) {
      if (await condition()) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, options.interval));
    }

    throw new Error(`Timeout waiting for condition after ${options.timeout}ms`);
  }

  // Helper to find button in Slack message
  findButton(message: any, actionId: string): any {
    if (!message.blocks) return null;

    for (const block of message.blocks) {
      if (block.type === "actions" && block.elements) {
        const button = block.elements.find(
          (e: any) => e.action_id === actionId
        );
        if (button) return button;
      }
    }
    return null;
  }

  // Helper to extract URL from text
  extractUrl(text: string): string | null {
    const urlMatch = text.match(/https?:\/\/[^\s]+/);
    return urlMatch ? urlMatch[0] : null;
  }
}
