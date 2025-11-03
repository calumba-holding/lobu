#!/usr/bin/env bun

import {
  createLogger,
  type FormOption,
  type UserInteraction,
  type UserSuggestion,
} from "@peerbot/core";
import type { Block } from "@slack/types";
import type { WebClient } from "@slack/web-api";
import type { InteractionService } from "../interactions";
import { convertMarkdownToSlack } from "./converters/markdown";

const logger = createLogger("slack-interactions");

/**
 * Determine interaction type from options
 */
function getInteractionType(
  options: any
): "simple" | "single-form" | "multi-form" {
  if (Array.isArray(options)) {
    // string[] = simple buttons
    if (typeof options[0] === "string") {
      return "simple";
    }
    // FormOption[] = multi-form
    return "multi-form";
  }
  // Record<string, FieldSchema> = single form
  return "single-form";
}

/**
 * Slack-specific interaction renderer
 */
export class SlackInteractionRenderer {
  constructor(
    private client: WebClient,
    private interactionService: InteractionService
  ) {
    this.interactionService.on(
      "interaction:created",
      (interaction: UserInteraction) => {
        this.renderInteraction(interaction).catch((error) => {
          logger.error("Failed to render interaction:", error);
        });
      }
    );

    this.interactionService.on(
      "suggestion:created",
      (suggestion: UserSuggestion) => {
        this.renderSuggestion(suggestion).catch((error) => {
          logger.error("Failed to render suggestion:", error);
        });
      }
    );

    this.interactionService.on(
      "interaction:responded",
      (interaction: UserInteraction) => {
        logger.info(
          `[SLACK-INTERACTIONS] Received interaction:responded event for ${interaction.id}`
        );
        if (interaction.response) {
          const responseData =
            interaction.response.answer || interaction.response.formData;
          logger.info(
            `[SLACK-INTERACTIONS] Response data: ${JSON.stringify(responseData)}`
          );
          if (responseData) {
            logger.info(
              `[SLACK-INTERACTIONS] Updating Slack message for interaction ${interaction.id}`
            );
            this.updateInteractionMessage(
              interaction.id,
              interaction,
              responseData
            ).catch((error) => {
              logger.error("Failed to update interaction message:", error);
            });
          }
        }
      }
    );
  }

  /**
   * Render interaction (buttons or forms)
   */
  async renderInteraction(interaction: UserInteraction): Promise<void> {
    logger.info(`Rendering interaction ${interaction.id}`);

    const type = getInteractionType(interaction.options);
    const blocks = this.buildBlocks(interaction, type);

    const result = await this.client.chat.postMessage({
      channel: interaction.channelId,
      thread_ts: interaction.threadId,
      text: blocks.text,
      blocks: blocks.blocks,
    });

    if (result.ts) {
      await this.interactionService.setMessageTs(interaction.id, result.ts);
    }

    await this.setThreadStatus(interaction.channelId, interaction.threadId, "");
  }

  /**
   * Render suggestions
   */
  async renderSuggestion(suggestion: UserSuggestion): Promise<void> {
    try {
      await this.client.assistant.threads.setSuggestedPrompts({
        channel_id: suggestion.channelId,
        thread_ts: suggestion.threadId,
        prompts: suggestion.prompts.map((p) => ({
          title: p.title,
          message: p.message,
        })),
      });
    } catch (error) {
      logger.warn("Failed to set suggested prompts:", error);
    }
  }

  /**
   * Build Slack blocks based on interaction type
   */
  private buildBlocks(
    interaction: UserInteraction,
    type: "simple" | "single-form" | "multi-form"
  ): { text: string; blocks: Block[] } {
    const question = convertMarkdownToSlack(interaction.question);

    if (type === "simple") {
      return this.buildSimpleBlocks(interaction, question);
    }

    if (type === "single-form") {
      return this.buildSingleFormBlocks(interaction, question);
    }

    return this.buildMultiFormBlocks(interaction, question);
  }

  /**
   * Build blocks for simple radio button choice (no text truncation, all options visible)
   */
  private buildSimpleBlocks(
    interaction: UserInteraction,
    question: string
  ): { text: string; blocks: Block[] } {
    const options = interaction.options as string[];

    const blocks: any[] = [
      {
        type: "context",
        elements: [{ type: "mrkdwn", text: question }],
      },
      {
        type: "actions",
        elements: [
          {
            type: "radio_buttons",
            action_id: `simple_radio_${interaction.id}`,
            options: options.map((opt, idx) => ({
              text: {
                type: "plain_text",
                text: opt.length > 75 ? `${opt.substring(0, 72)}...` : opt, // Slack limit: 75 chars for option text
              },
              value: `${idx}`, // Use index as value to handle long/special chars
            })),
          },
        ],
      },
    ];

    return { text: question, blocks };
  }

  /**
   * Build blocks for single modal form
   */
  private buildSingleFormBlocks(
    interaction: UserInteraction,
    question: string
  ): { text: string; blocks: Block[] } {
    const blocks: any[] = [
      {
        type: "header",
        text: { type: "plain_text", text: "Form Required" },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: question },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Open Form" },
            action_id: `form_${interaction.id}`,
            value: "open",
            style: "primary",
          },
        ],
      },
    ];

    return { text: question, blocks };
  }

  /**
   * Build blocks for multi-form workflow
   */
  private buildMultiFormBlocks(
    interaction: UserInteraction,
    question: string
  ): { text: string; blocks: Block[] } {
    const blocks: any[] = [
      {
        type: "header",
        text: { type: "plain_text", text: "Configuration Required" },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: question },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Open Form" },
            action_id: `multiform_open_${interaction.id}`,
            value: "open",
            style: "primary",
          },
        ],
      },
    ];

    return { text: question, blocks };
  }

  /**
   * Update message after user responds
   */
  async updateInteractionMessage(
    interactionId: string,
    interaction: UserInteraction,
    answerOrFormData: string | Record<string, any>
  ): Promise<void> {
    const messageTs = await this.interactionService.getMessageTs(interactionId);

    if (!messageTs) {
      logger.warn(`No message timestamp for interaction ${interactionId}`);
      return;
    }

    const timestamp = new Date().toLocaleString();
    const isFormData = typeof answerOrFormData === "object";

    const blocks: any[] = [
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: convertMarkdownToSlack(interaction.question),
          },
        ],
      },
    ];

    if (isFormData) {
      // Form submission: show formatted data
      const formattedData = JSON.stringify(answerOrFormData, null, 2);
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `\`\`\`\n${formattedData}\n\`\`\``,
        },
      });
      blocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `✅ Submitted by <@${interaction.userId}> at ${timestamp}`,
          },
        ],
      });
    } else {
      blocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `<@${interaction.userId}> at ${timestamp}`,
          },
        ],
      });
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `> ${answerOrFormData}`,
        },
      });
    }

    await this.client.chat.update({
      channel: interaction.channelId,
      ts: messageTs,
      text: isFormData ? "Form submitted" : `Answered: ${answerOrFormData}`,
      blocks,
    });

    await this.setThreadStatus(
      interaction.channelId,
      interaction.threadId,
      null
    );
  }

  /**
   * Open modal for single-form or multi-form option
   */
  async openModal(
    triggerId: string,
    interaction: UserInteraction,
    currentTab?: string // For multi-form, which tab to show
  ): Promise<void> {
    const options = interaction.options;

    // Multi-form: open tabbed modal
    if (Array.isArray(options) && typeof options[0] !== "string") {
      const formOptions = options as FormOption[];
      const tabIndex = currentTab
        ? formOptions.findIndex((f) => f.label === currentTab)
        : 0;
      const view = this.buildTabbedModal(interaction, tabIndex);

      await this.client.views.open({
        trigger_id: triggerId,
        view,
      });
      return;
    }

    // Single-form: open simple modal
    const fields = options as Record<string, any>;
    const view = this.buildModalView(interaction, fields);

    await this.client.views.open({
      trigger_id: triggerId,
      view,
    });
  }

  /**
   * Build tabbed modal for multi-form workflow
   */
  private buildTabbedModal(
    interaction: UserInteraction,
    currentTabIndex: number
  ): any {
    const options = interaction.options as FormOption[];
    const partialData = interaction.partialData || {};
    const currentTab = options[currentTabIndex];

    if (!currentTab) {
      throw new Error(`Invalid tab index: ${currentTabIndex}`);
    }

    const isLastTab = currentTabIndex === options.length - 1;

    const blocks: any[] = [];

    // Tab selector buttons
    blocks.push({
      type: "actions",
      block_id: "tab_selector",
      elements: options.map((opt, idx) => ({
        type: "button",
        text: {
          type: "plain_text",
          text: `${partialData[opt.label] ? "✓ " : ""}${opt.label}`,
        },
        action_id: `tab_switch_${interaction.id}_${idx}`,
        value: String(idx),
        style: idx === currentTabIndex ? "primary" : undefined,
      })),
    });

    // Divider
    blocks.push({ type: "divider" });

    // Current tab's form fields
    for (const [fieldName, fieldSchema] of Object.entries(currentTab.fields)) {
      const label =
        fieldSchema.label ||
        fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
      const blockId = `field_${fieldName}`;

      // Get saved value if exists
      const savedValue = partialData[currentTab.label]?.[fieldName];

      if (fieldSchema.type === "text" || fieldSchema.type === "textarea") {
        blocks.push({
          type: "input",
          block_id: blockId,
          element: {
            type: "plain_text_input",
            action_id: fieldName,
            placeholder: fieldSchema.placeholder
              ? { type: "plain_text", text: fieldSchema.placeholder }
              : undefined,
            multiline: fieldSchema.type === "textarea",
            initial_value: savedValue || undefined,
          },
          label: { type: "plain_text", text: label },
          optional: !fieldSchema.required,
        });
      } else if (fieldSchema.type === "select") {
        blocks.push({
          type: "input",
          block_id: blockId,
          element: {
            type: "static_select",
            action_id: fieldName,
            options: (fieldSchema.options || []).map((opt: string) => ({
              text: { type: "plain_text", text: opt },
              value: opt,
            })),
            placeholder: {
              type: "plain_text",
              text: fieldSchema.placeholder || "Select an option",
            },
            initial_option: savedValue
              ? {
                  text: { type: "plain_text", text: savedValue },
                  value: savedValue,
                }
              : undefined,
          },
          label: { type: "plain_text", text: label },
          optional: !fieldSchema.required,
        });
      } else if (fieldSchema.type === "number") {
        blocks.push({
          type: "input",
          block_id: blockId,
          element: {
            type: "plain_text_input",
            action_id: fieldName,
            placeholder: fieldSchema.placeholder
              ? { type: "plain_text", text: fieldSchema.placeholder }
              : undefined,
            initial_value:
              savedValue !== undefined ? String(savedValue) : undefined,
          },
          label: { type: "plain_text", text: label },
          optional: !fieldSchema.required,
        });
      } else if (fieldSchema.type === "checkbox") {
        blocks.push({
          type: "input",
          block_id: blockId,
          element: {
            type: "checkboxes",
            action_id: fieldName,
            options: [
              {
                text: { type: "plain_text", text: label },
                value: "true",
              },
            ],
            initial_options: savedValue
              ? [
                  {
                    text: { type: "plain_text", text: label },
                    value: "true",
                  },
                ]
              : undefined,
          },
          label: { type: "plain_text", text: label },
          optional: !fieldSchema.required,
        });
      } else if (fieldSchema.type === "multiselect") {
        blocks.push({
          type: "input",
          block_id: blockId,
          element: {
            type: "multi_static_select",
            action_id: fieldName,
            options: (fieldSchema.options || []).map((opt: string) => ({
              text: { type: "plain_text", text: opt },
              value: opt,
            })),
            placeholder: {
              type: "plain_text",
              text: fieldSchema.placeholder || "Select options",
            },
            initial_options:
              savedValue && Array.isArray(savedValue)
                ? savedValue.map((v: string) => ({
                    text: { type: "plain_text", text: v },
                    value: v,
                  }))
                : undefined,
          },
          label: { type: "plain_text", text: label },
          optional: !fieldSchema.required,
        });
      }
    }

    // Next/Submit button
    if (!isLastTab) {
      blocks.push({
        type: "actions",
        block_id: "navigation",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Next →" },
            action_id: `tab_next_${interaction.id}`,
            value: String(currentTabIndex + 1),
            style: "primary",
          },
        ],
      });
    }

    return {
      type: "modal",
      callback_id: `multiform_submit_${interaction.id}`,
      title: { type: "plain_text", text: "Configure Settings" },
      submit: { type: "plain_text", text: isLastTab ? "Submit All" : "Save" },
      close: { type: "plain_text", text: "Cancel" },
      blocks,
      private_metadata: JSON.stringify({
        interactionId: interaction.id,
        currentTabIndex,
        totalTabs: options.length,
      }),
    };
  }

  /**
   * Build Slack modal view from fields
   */
  private buildModalView(
    interaction: UserInteraction,
    fields: Record<string, any>,
    formLabel?: string
  ): any {
    const blocks: any[] = [];

    for (const [fieldName, fieldSchema] of Object.entries(fields)) {
      const label =
        fieldSchema.label ||
        fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
      const blockId = `field_${fieldName}`;

      if (fieldSchema.type === "text" || fieldSchema.type === "textarea") {
        blocks.push({
          type: "input",
          block_id: blockId,
          element: {
            type:
              fieldSchema.type === "textarea"
                ? "plain_text_input"
                : "plain_text_input",
            action_id: fieldName,
            placeholder: fieldSchema.placeholder
              ? { type: "plain_text", text: fieldSchema.placeholder }
              : undefined,
            multiline: fieldSchema.type === "textarea",
          },
          label: { type: "plain_text", text: label },
          optional: !fieldSchema.required,
        });
      } else if (fieldSchema.type === "select") {
        blocks.push({
          type: "input",
          block_id: blockId,
          element: {
            type: "static_select",
            action_id: fieldName,
            options: (fieldSchema.options || []).map((opt: string) => ({
              text: { type: "plain_text", text: opt },
              value: opt,
            })),
            placeholder: {
              type: "plain_text",
              text: fieldSchema.placeholder || "Select an option",
            },
          },
          label: { type: "plain_text", text: label },
          optional: !fieldSchema.required,
        });
      } else if (fieldSchema.type === "number") {
        blocks.push({
          type: "input",
          block_id: blockId,
          element: {
            type: "plain_text_input",
            action_id: fieldName,
            placeholder: fieldSchema.placeholder
              ? { type: "plain_text", text: fieldSchema.placeholder }
              : undefined,
          },
          label: { type: "plain_text", text: label },
          optional: !fieldSchema.required,
        });
      } else if (fieldSchema.type === "checkbox") {
        blocks.push({
          type: "input",
          block_id: blockId,
          element: {
            type: "checkboxes",
            action_id: fieldName,
            options: [
              {
                text: { type: "plain_text", text: label },
                value: "true",
              },
            ],
          },
          label: { type: "plain_text", text: label },
          optional: !fieldSchema.required,
        });
      } else if (fieldSchema.type === "multiselect") {
        blocks.push({
          type: "input",
          block_id: blockId,
          element: {
            type: "multi_static_select",
            action_id: fieldName,
            options: (fieldSchema.options || []).map((opt: string) => ({
              text: { type: "plain_text", text: opt },
              value: opt,
            })),
            placeholder: {
              type: "plain_text",
              text: fieldSchema.placeholder || "Select options",
            },
          },
          label: { type: "plain_text", text: label },
          optional: !fieldSchema.required,
        });
      }
    }

    const title = formLabel || "Form";
    const callbackId = formLabel
      ? `multiform_submit_${interaction.id}_${formLabel}`
      : `form_submit_${interaction.id}`;

    return {
      type: "modal",
      callback_id: callbackId,
      title: { type: "plain_text", text: title },
      submit: { type: "plain_text", text: formLabel ? "Save" : "Submit" },
      close: { type: "plain_text", text: "Cancel" },
      blocks,
      private_metadata: JSON.stringify({
        interactionId: interaction.id,
        formLabel,
      }),
    };
  }

  /**
   * Update modal to show different tab
   */
  async updateModalWithTab(
    viewId: string,
    client: any,
    interaction: UserInteraction,
    tabIndex: number
  ): Promise<void> {
    const view = this.buildTabbedModal(interaction, tabIndex);

    await client.views.update({
      view_id: viewId,
      view,
    });
  }

  /**
   * Set thread status
   */
  async setThreadStatus(
    channelId: string,
    threadId: string,
    status: string | null
  ): Promise<void> {
    try {
      await this.client.assistant.threads.setStatus({
        channel_id: channelId,
        thread_ts: threadId,
        status: status || "",
      });
    } catch (error) {
      logger.warn("Failed to set thread status:", error);
    }
  }
}

/**
 * Register interaction handlers
 */
export function registerInteractionHandlers(
  app: any,
  interactionService: InteractionService,
  renderer: SlackInteractionRenderer
): void {
  // Simple radio button selection
  app.action(/^simple_radio_(.+)$/, async ({ ack, action }: any) => {
    await ack();

    const matches = action.action_id.match(/^simple_radio_(.+)$/);
    if (!matches) return;

    const [_, interactionId] = matches;

    const interaction = await interactionService.getInteraction(interactionId);
    if (!interaction) {
      logger.warn(`Interaction ${interactionId} not found`);
      return;
    }

    // Get the selected option using the index stored in value
    const selectedIndex = parseInt(action.selected_option.value, 10);
    const options = interaction.options as string[];
    const answer = options[selectedIndex];

    if (!answer) {
      logger.warn(
        `Invalid option index ${selectedIndex} for interaction ${interactionId}`
      );
      return;
    }

    await interactionService.respond(interactionId, { answer });
    await renderer.updateInteractionMessage(interactionId, interaction, answer);
  });

  // Single-form "Open Form" button
  app.action(/^form_(.+)$/, async ({ ack, action, body }: any) => {
    await ack();

    const matches = action.action_id.match(/^form_(.+)$/);
    if (!matches) return;

    const [_, interactionId] = matches;

    const interaction = await interactionService.getInteraction(interactionId);
    if (!interaction) {
      logger.warn(`Interaction ${interactionId} not found`);
      return;
    }

    await renderer.openModal(body.trigger_id, interaction);
  });

  // Multi-form "Open Form" button
  app.action(/^multiform_open_(.+)$/, async ({ ack, action, body }: any) => {
    await ack();

    const matches = action.action_id.match(/^multiform_open_(.+)$/);
    if (!matches) return;

    const [_, interactionId] = matches;

    const interaction = await interactionService.getInteraction(interactionId);
    if (!interaction) {
      logger.warn(`Interaction ${interactionId} not found`);
      return;
    }

    await renderer.openModal(body.trigger_id, interaction);
  });

  // Tab switching (direct tab button click)
  app.action(
    /^tab_switch_(.+)_(\d+)$/,
    async ({ ack, action, body, client }: any) => {
      await ack();

      const matches = action.action_id.match(/^tab_switch_(.+)_(\d+)$/);
      if (!matches) return;

      const [_, interactionId, tabIndexStr] = matches;
      const newTabIndex = parseInt(tabIndexStr, 10);

      // Save current tab data before switching
      const currentTabData = extractFormData(body.view.state.values);
      const metadata = JSON.parse(body.view.private_metadata);
      const interaction =
        await interactionService.getInteraction(interactionId);

      if (interaction) {
        const options = interaction.options as FormOption[];
        const currentTab = options[metadata.currentTabIndex];

        if (currentTab) {
          // Save current tab's data
          await interactionService.savePartialData(
            interactionId,
            currentTab.label,
            currentTabData
          );

          // Re-fetch interaction to get updated partial data
          const updatedInteraction =
            await interactionService.getInteraction(interactionId);
          if (updatedInteraction) {
            await renderer.updateModalWithTab(
              body.view.id,
              client,
              updatedInteraction,
              newTabIndex
            );
          }
        }
      }
    }
  );

  // Next button (advance to next tab)
  app.action(/^tab_next_(.+)$/, async ({ ack, action, body, client }: any) => {
    await ack();

    const matches = action.action_id.match(/^tab_next_(.+)$/);
    if (!matches) return;

    const [_, interactionId] = matches;
    const newTabIndex = parseInt(action.value, 10);

    // Save current tab data before advancing
    const currentTabData = extractFormData(body.view.state.values);
    const metadata = JSON.parse(body.view.private_metadata);
    const interaction = await interactionService.getInteraction(interactionId);

    if (interaction) {
      const options = interaction.options as FormOption[];
      const currentTab = options[metadata.currentTabIndex];

      if (currentTab) {
        // Save current tab's data
        await interactionService.savePartialData(
          interactionId,
          currentTab.label,
          currentTabData
        );

        // Re-fetch interaction to get updated partial data
        const updatedInteraction =
          await interactionService.getInteraction(interactionId);
        if (updatedInteraction) {
          await renderer.updateModalWithTab(
            body.view.id,
            client,
            updatedInteraction,
            newTabIndex
          );
        }
      }
    }
  });

  // Modal submission for single-form
  app.view(/^form_submit_(.+)$/, async ({ ack, view }: any) => {
    await ack();

    const matches = view.callback_id.match(/^form_submit_(.+)$/);
    if (!matches) return;

    const [_, interactionId] = matches;

    const formData = extractFormData(view.state.values);

    const interaction = await interactionService.getInteraction(interactionId);
    if (!interaction) return;

    await interactionService.respond(interactionId, { formData });
    await renderer.updateInteractionMessage(
      interactionId,
      interaction,
      formData
    );
  });

  // Modal submission for tabbed multi-form
  app.view(/^multiform_submit_(.+)$/, async ({ ack, view }: any) => {
    await ack();

    const matches = view.callback_id.match(/^multiform_submit_(.+)$/);
    if (!matches) return;

    const [_, interactionId] = matches;

    // Get current tab data from modal
    const currentTabData = extractFormData(view.state.values);
    const metadata = JSON.parse(view.private_metadata);
    const interaction = await interactionService.getInteraction(interactionId);

    if (!interaction) return;

    const options = interaction.options as FormOption[];
    const currentTab = options[metadata.currentTabIndex];

    if (!currentTab) return;

    // Save current tab's data
    await interactionService.savePartialData(
      interactionId,
      currentTab.label,
      currentTabData
    );

    // If on last tab, submit all data
    if (metadata.currentTabIndex === metadata.totalTabs - 1) {
      // Get all collected data
      const updatedInteraction =
        await interactionService.getInteraction(interactionId);
      if (updatedInteraction) {
        const allData = updatedInteraction.partialData || {};
        await interactionService.respond(interactionId, { formData: allData });
        await renderer.updateInteractionMessage(
          interactionId,
          updatedInteraction,
          allData
        );
      }
    }
    // Otherwise, modal will just close (user can reopen to continue)
  });
}

/**
 * Extract form data from Slack modal state
 */
function extractFormData(stateValues: any): Record<string, any> {
  const formData: Record<string, any> = {};

  for (const [blockId, block] of Object.entries(stateValues)) {
    if (!blockId.startsWith("field_")) continue;

    const fieldName = blockId.replace("field_", "");
    const actionValue = Object.values(block as any)[0] as any;

    if (!actionValue) continue;

    // Handle different input types
    if (actionValue.type === "plain_text_input") {
      formData[fieldName] = actionValue.value;
    } else if (actionValue.type === "static_select") {
      formData[fieldName] = actionValue.selected_option?.value;
    } else if (actionValue.type === "multi_static_select") {
      formData[fieldName] =
        actionValue.selected_options?.map((opt: any) => opt.value) || [];
    } else if (actionValue.type === "checkboxes") {
      formData[fieldName] = actionValue.selected_options?.length > 0;
    }
  }

  return formData;
}
