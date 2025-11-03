export interface ClaudeExecutionOptions {
  model?: string;
  timeoutMinutes?: number;
  allowedTools?: string[];
  maxTokens?: number;
  customInstructions?: string;
  workingDirectory?: string;
  sessionId?: string;
  resume?: boolean;
  permissionMode?: string;
}

export interface SessionContext {
  platform: string; // Platform identifier (e.g., "slack", "discord", "teams")
  channelId: string;
  userId: string;
  messageId?: string;
  threadId?: string;
  conversationHistory?: ConversationMessage[];
  customInstructions?: string;
  workingDirectory?: string;
}

export interface ConversationMessage {
  role: "system" | "user" | "assistant";
  content: string;
  timestamp: number;
}

/**
 * Platform-provided execution hints passed through gateway → worker.
 * Extends ClaudeExecutionOptions with additional knobs and index signature
 * for forward compatibility.
 */
export interface AgentOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  allowedTools?: string | string[];
  disallowedTools?: string | string[];
  timeoutMinutes?: number | string;
  [key: string]: string | number | boolean | string[] | undefined;
}

/**
 * Platform-agnostic log level type
 * Maps to common logging levels used across different platforms
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

// ============================================================================
// Instruction Provider Types
// ============================================================================

/**
 * Context information passed to instruction providers
 */
export interface InstructionContext {
  userId: string;
  sessionKey: string;
  workingDirectory: string;
  availableProjects?: string[];
}

/**
 * Interface for components that contribute custom instructions
 */
export interface InstructionProvider {
  /** Unique identifier for this provider */
  name: string;

  /** Priority for ordering (lower = earlier in output) */
  priority: number;

  /**
   * Generate instruction text for this provider
   * @param context - Context information for instruction generation
   * @returns Instruction text or empty string if none
   */
  getInstructions(context: InstructionContext): Promise<string> | string;
}

// ============================================================================
// Thread Response Types
// ============================================================================

/**
 * Shared payload contract for worker → platform thread responses.
 * Ensures gateway consumers and workers stay type-aligned.
 */
export interface ThreadResponsePayload {
  messageId: string;
  channelId: string;
  threadId: string;
  userId: string;
  teamId?: string;
  content?: string; // Used only for ephemeral messages (OAuth/auth flows)
  delta?: string;
  isFullReplacement?: boolean;
  processedMessageIds?: string[];
  error?: string;
  timestamp: number;
  originalMessageId?: string;
  moduleData?: Record<string, unknown>;
  botResponseId?: string;
  ephemeral?: boolean; // If true, message should be sent as ephemeral (only visible to user)
}

// ============================================================================
// User Interaction Types
// ============================================================================

/**
 * Form field schema for modal inputs
 */
export interface FieldSchema {
  type: "text" | "select" | "textarea" | "number" | "checkbox" | "multiselect";
  label?: string; // Defaults to capitalized field name
  placeholder?: string;
  options?: string[]; // For select/multiselect
  required?: boolean;
  default?: any;
}

/**
 * Multi-form option (button that opens a modal)
 */
export interface FormOption {
  label: string;
  fields: Record<string, FieldSchema>;
}

/**
 * Interaction options - determines UX pattern:
 * - string[] → Simple buttons (immediate response)
 * - Record<string, FieldSchema> → Single modal form
 * - FormOption[] → Multi-modal workflow (staged submission)
 */
export type InteractionOptions =
  | string[]
  | Record<string, FieldSchema>
  | FormOption[];

/**
 * User response to an interaction
 * Format depends on interaction type:
 * - Simple buttons: { answer: string }
 * - Single form: { formData: Record<string, any> }
 * - Multi-form: { formData: Record<string, Record<string, any>> }
 */
export interface UserInteractionResponse {
  answer?: string; // For simple button responses
  formData?: Record<string, any>; // For single form or multi-form (nested)
  timestamp: number;
}

/**
 * Blocking user interaction - agent waits for response
 */
export interface UserInteraction {
  id: string;
  userId: string;
  threadId: string;
  channelId: string;
  teamId?: string;

  blocking: true; // Always true - distinguishes from suggestions

  question: string; // The question or prompt to display
  options: InteractionOptions; // Determines UX pattern (buttons/form/multi-form)

  metadata?: any; // Optional metadata for tracking/context

  status: "pending" | "responded" | "expired";
  response?: UserInteractionResponse;
  createdAt: number;
  expiresAt: number;
  respondedAt?: number;

  // Partial form data (for multi-form workflows)
  partialData?: Record<string, Record<string, any>>;
}

/**
 * Suggested prompt for user
 */
export interface SuggestedPrompt {
  title: string; // Short label shown as chip
  message: string; // Full message sent when clicked
}

/**
 * Non-blocking suggestions - agent continues immediately
 * Used for optional next steps
 */
export interface UserSuggestion {
  id: string;
  userId: string;
  threadId: string;
  channelId: string;
  teamId?: string;

  blocking: false; // Always false - distinguishes from interactions

  prompts: SuggestedPrompt[];
}
