import type {
  ActionButton,
  DispatcherContext,
  DispatcherModule,
  HomeTabModule,
  ModuleSessionContext,
  OrchestratorModule,
  WorkerContext,
  WorkerModule,
} from "./types";

/**
 * Base module class that provides default implementations for all optional methods.
 * Modules can extend this class and override only what they need.
 */
export abstract class BaseModule<TModuleData = unknown>
  implements
    WorkerModule<TModuleData>,
    DispatcherModule<TModuleData>,
    HomeTabModule<TModuleData>,
    OrchestratorModule<TModuleData>
{
  abstract name: string;
  abstract isEnabled(): boolean;

  async init(): Promise<void> {
    // Default: no-op
  }

  registerEndpoints(_app: any): void {
    // Default: no-op
  }

  async renderHomeTab(_userId: string): Promise<any[]> {
    // Default: no home tab blocks
    return [];
  }

  async handleHomeTabAction(
    _actionId: string,
    _userId: string,
    _value?: any
  ): Promise<void> {
    // Default: no-op
  }

  async initWorkspace(_config: any): Promise<void> {
    // Default: no-op
  }

  async onSessionStart(
    context: ModuleSessionContext
  ): Promise<ModuleSessionContext> {
    // Default: pass through unchanged
    return context;
  }

  async onSessionEnd(_context: ModuleSessionContext): Promise<ActionButton[]> {
    // Default: no buttons
    return [];
  }

  async onBeforeResponse(_context: WorkerContext): Promise<TModuleData | null> {
    // Default: no data
    return null;
  }

  async buildEnvVars(
    _userId: string,
    baseEnv: Record<string, string>
  ): Promise<Record<string, string>> {
    // Default: pass through unchanged
    return baseEnv;
  }

  getContainerAddress(): string {
    // Default: empty string
    return "";
  }

  async generateActionButtons(
    _context: DispatcherContext<TModuleData>
  ): Promise<ActionButton[]> {
    // Default: no buttons
    return [];
  }

  async handleAction(
    _actionId: string,
    _userId: string,
    _context: any
  ): Promise<boolean> {
    // Default: not handled
    return false;
  }
}
