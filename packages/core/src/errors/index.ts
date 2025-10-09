// Export base error class
export { BaseError } from "./base-error";

// Export orchestrator errors
export { ErrorCode, OrchestratorError } from "./orchestrator-errors";

// Export worker errors
export {
  CoreWorkerError,
  SessionError,
  SlackError,
  WorkerError,
  WorkspaceError,
} from "./worker-errors";

// Dispatcher errors - GitHub-specific errors moved to GitHub module
