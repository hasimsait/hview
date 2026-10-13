export class Container {
  private services = new Map<symbol, any>();
  private factories = new Map<symbol, (c: Container) => any>();
  private singletons = new Map<symbol, any>();

  registerInstance<T>(token: symbol, instance: T): void {
    this.services.set(token, instance);
  }

  registerSingleton<T>(token: symbol, factory: (c: Container) => T): void {
    this.factories.set(token, factory);
  }

  resolve<T>(token: symbol): T {
    if (this.services.has(token)) {
      return this.services.get(token);
    }

    if (this.singletons.has(token)) {
      return this.singletons.get(token);
    }

    if (this.factories.has(token)) {
      const factory = this.factories.get(token)!;
      const instance = factory(this);
      this.singletons.set(token, instance);
      return instance;
    }

    throw new Error(`[DI Container] Service not registered for token: ${token.toString()}`);
  }
}

export const defaultContainer = new Container();
