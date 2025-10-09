import type {
  DispatcherModule,
  HomeTabModule,
  ModuleInterface,
  OrchestratorModule,
  WorkerModule,
} from "./types";

export interface IModuleRegistry {
  getDispatcherModules(): DispatcherModule[];
  getHomeTabModules(): HomeTabModule[];
  getWorkerModules(): WorkerModule[];
  getOrchestratorModules(): OrchestratorModule[];
  registerAvailableModules(): Promise<void>;
  initAll(): Promise<void>;
  registerEndpoints(app: any): void;
  clear(): void;
}

/**
 * Module registry for managing plugin modules across the application.
 *
 * Modules must be explicitly registered by calling `register()` before use.
 * This allows each package (dispatcher, worker) to load only the modules it needs.
 *
 * For production: use the global `moduleRegistry` instance
 * For testing: create a new instance to avoid shared state
 *
 * @example
 * // In dispatcher/worker
 * import { GitHubModule } from '@peerbot/github';
 * moduleRegistry.register(new GitHubModule());
 * await moduleRegistry.initAll();
 *
 * @example
 * // In tests
 * const testRegistry = new ModuleRegistry();
 * testRegistry.register(mockModule);
 */
export class ModuleRegistry implements IModuleRegistry {
  private modules: Map<string, ModuleInterface> = new Map();

  register(module: ModuleInterface): void {
    if (module.isEnabled()) {
      this.modules.set(module.name, module);
    }
  }

  /**
   * Automatically discover and register available modules.
   * Tries to import module packages and registers them if available.
   *
   * @param modulePackages - Optional list of module package names to try loading.
   *                         Defaults to built-in modules. Users can extend this list
   *                         with custom modules.
   *
   * @example
   * // Use default built-in modules
   * await moduleRegistry.registerAvailableModules();
   *
   * @example
   * // Add custom modules
   * await moduleRegistry.registerAvailableModules([
   *   '@peerbot/github',
   *   '@mycompany/slack-module',
   *   '@mycompany/jira-module'
   * ]);
   */
  async registerAvailableModules(
    modulePackages: string[] = ["@peerbot/github"]
  ): Promise<void> {
    for (const packageName of modulePackages) {
      try {
        // Dynamic import to avoid build-time dependencies
        const moduleExports = await import(packageName);

        // Try common export patterns
        const ModuleClass =
          moduleExports.GitHubModule ||
          moduleExports.default ||
          Object.values(moduleExports).find(
            (exp) => typeof exp === "function" && exp.name.endsWith("Module")
          );

        if (ModuleClass && typeof ModuleClass === "function") {
          const moduleInstance = new (ModuleClass as any)();
          if (!this.modules.has(moduleInstance.name)) {
            this.register(moduleInstance);
            console.debug(`✅ ${packageName} registered`);
          }
        } else {
          console.debug(`${packageName}: No module class found in exports`);
        }
      } catch (error) {
        console.debug(`${packageName} not available`);
      }
    }
  }

  async initAll(): Promise<void> {
    for (const module of this.modules.values()) {
      if (module.init) {
        await module.init();
      }
    }
  }

  registerEndpoints(app: any): void {
    for (const module of this.modules.values()) {
      if (module.registerEndpoints) {
        try {
          module.registerEndpoints(app);
        } catch (error) {
          console.error(
            `Failed to register endpoints for module ${module.name}:`,
            error
          );
        }
      }
    }
  }

  getAllModules(): ModuleInterface[] {
    return Array.from(this.modules.values());
  }

  getHomeTabModules(): HomeTabModule[] {
    return Array.from(this.modules.values()).filter(
      (m): m is HomeTabModule => "renderHomeTab" in m
    );
  }

  getWorkerModules(): WorkerModule[] {
    return Array.from(this.modules.values()).filter(
      (m): m is WorkerModule => "onBeforeResponse" in m
    );
  }

  getOrchestratorModules(): OrchestratorModule[] {
    return Array.from(this.modules.values()).filter(
      (m): m is OrchestratorModule => "buildEnvVars" in m
    );
  }

  getDispatcherModules(): DispatcherModule[] {
    return Array.from(this.modules.values()).filter(
      (m): m is DispatcherModule => "generateActionButtons" in m
    );
  }

  getModule<T extends ModuleInterface>(name: string): T | undefined {
    return this.modules.get(name) as T;
  }

  /**
   * Clear all registered modules. Useful for testing.
   */
  clear(): void {
    this.modules.clear();
  }
}

/**
 * Global registry instance for production use.
 * For testing, create separate instances: `new ModuleRegistry({ skipAutoRegister: true })`
 */
export const moduleRegistry = new ModuleRegistry();

export * from "./base-module";
export * from "./types";
