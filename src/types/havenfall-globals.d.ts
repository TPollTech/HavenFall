export {};

declare global {
  interface Window {
    GameSystems?: {
      registerTick(id: string, fn: (dt: number) => void, options?: { order?: number; enabled?: boolean }): boolean;
      unregisterTick(id: string): boolean;
      hasTick(id: string): boolean;
      tick(dt: number, safeTick?: (id: string, fn: () => void) => void): void;
      registerColonistUpdateGuard(id: string, fn: (colonist: unknown, dt: number) => boolean, options?: { order?: number; enabled?: boolean }): boolean;
      runColonistUpdateGuards(colonist: unknown, dt: number): boolean;
      registerBeforeColonistUpdate(id: string, fn: (colonist: unknown, dt: number) => void, options?: { order?: number; enabled?: boolean }): boolean;
      runBeforeColonistUpdate(colonist: unknown, dt: number): void;
      registerAfterColonistUpdate(id: string, fn: (colonist: unknown, dt: number) => void, options?: { order?: number; enabled?: boolean }): boolean;
      runAfterColonistUpdate(colonist: unknown, dt: number): void;
      registerAutoTaskProvider(id: string, fn: (colonist: unknown) => boolean, options?: { order?: number; enabled?: boolean }): boolean;
      assignAutoTask(colonist: unknown): boolean;
      registerTaskHandler(taskType: string, id: string, fn: (colonist: unknown, task: unknown, tick: number) => boolean, options?: { order?: number; enabled?: boolean }): boolean;
      handleTask(colonist: unknown, task: unknown, tick: number): boolean;
      registerDrawOverlay(id: string, fn: () => void, options?: { order?: number; enabled?: boolean }): boolean;
      drawRegisteredOverlays(): void;
      registerMovementModifier(id: string, fn: (colonist: unknown, multiplier: number) => number, options?: { order?: number; enabled?: boolean }): boolean;
      movementMultiplier(colonist: unknown): number;
      registerWorkRateModifier(id: string, fn: (rate: number, colonist: unknown, kind: string, target?: unknown) => number, options?: { order?: number; enabled?: boolean }): boolean;
      applyWorkRateModifiers(rate: number, colonist: unknown, kind: string, target?: unknown): number;
      installHook(id: string, installer: () => void): boolean;
      installedHooks: Set<string>;
    };
    GameState?: {
      resources(): Record<string, number>;
      hasResources(cost?: Record<string, number>): boolean;
      addResources(gain?: Record<string, number>): Record<string, number>;
      payResources(cost?: Record<string, number>): boolean;
      items(): Record<string, number>;
      hasItems(cost?: Record<string, number>): boolean;
      addItems(gain?: Record<string, number>): Record<string, number>;
      payItems(cost?: Record<string, number>): boolean;
      addRecipeOutput(output?: { resources?: Record<string, number>; items?: Record<string, number> }): void;
      objects(): unknown[];
      addObject(obj: unknown): unknown;
      getObjectById(id: unknown): unknown | null;
      removeObjectById(id: unknown): unknown | null;
      replaceObjects(nextObjects?: unknown[]): unknown[];
      invalidateObjectIndexes(): void;
    };
    Havenfall?: {
      version: string;
      systems?: Window['GameSystems'];
      stateApi?: Window['GameState'];
      defs: Record<string, unknown>;
      readonly state: unknown;
      readonly screen: string;
    };
  }
}
