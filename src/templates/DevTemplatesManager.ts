import { CompilerLock } from '../lock';
import { PatchData, Template } from './Template';

export type TemplateEvents = {
  create: [Template],
  patch: [PatchData],
  error: [Error],
  remove: [],
};

export type TemplateListener = {
  [EventName in keyof TemplateEvents]?: (...args: TemplateEvents[EventName]) => void;
};

export interface TemplatesManager {
  templateNames(): ReadonlyArray<string>;

  update(): Promise<void>;

  flush(): Promise<void>;

  emitContent(name: string, content: string): void;

  emitError(name: string, error: Error): void;

  emitTouch(name: string): void;

  subscribe(name: string, listener?: TemplateListener): Promise<[Template | undefined, () => void]>;
}


type TemplateData = {
  name: string;
  template?: Template;
  wasRequired: boolean;
  wasEmitted: boolean;
  requestsCount: number;
  expiringRequests: Array<number>;
  pendingAction: (() => void) | undefined;
  listeners: Set<TemplateListener>;
};

export class DevTemplatesManager implements TemplatesManager {
  protected readonly templatesData = new Map<string, TemplateData>();

  constructor(
    protected readonly lock: CompilerLock,
    protected readonly invalidate: () => void,
  ) {
  }

  templateNames() {
    return [...this.templatesData.values()]
      .filter(data => data.requestsCount !== 0)
      .map(data => data.name);
  }

  async update() {
    for (const data of this.templatesData.values()) {
      const activeExpiringRequests = data.expiringRequests.filter(ts => ts > Date.now());
      data.requestsCount -= data.expiringRequests.length - activeExpiringRequests.length;
      data.expiringRequests = activeExpiringRequests;

      data.wasEmitted = false;
      if (data.requestsCount === 0) {
        data.wasRequired = false;
      }
      data.pendingAction = undefined;
    }
  }

  async flush() {
    for (const data of this.templatesData.values()) {
      if (!data.wasEmitted && data.template !== undefined) {
        data.pendingAction = () => {
          data.template = undefined;
          this.emitEvent(data.name, 'remove');
        };
      }

      Promise.resolve(data.pendingAction).then(action => action?.());
      data.pendingAction = undefined;
    }
  }

  private templateData(name: string): TemplateData {
    if (!this.templatesData.has(name)) {
      this.templatesData.set(name, {
        name,
        template: undefined,
        wasRequired: false,
        wasEmitted: false,
        requestsCount: 0,
        expiringRequests: [],
        pendingAction: undefined,
        listeners: new Set(),
      });
    }
    return this.templatesData.get(name)!;
  }

  private emitEvent<T extends keyof TemplateEvents>(name: string, event: T, ...args: TemplateEvents[T]) {
    for (const listener of this.templateData(name).listeners) {
      Promise.resolve().then(() => listener[event]?.(...args));
    }
  }

  emitContent(name: string, content: string) {
    const data = this.templateData(name);

    data.wasEmitted = true;
    data.pendingAction = () => {
      if (data.template == undefined) {
        data.template = new Template(content);
        this.emitEvent(name, 'create', data.template);
      } else {
        const patch = data.template.apply(content);

        this.emitEvent(name, 'patch', patch);
      }
    };
  }

  emitError(name: string, error: Error) {
    const data = this.templateData(name);
    data.wasEmitted = true;
    data.pendingAction = () => {
      this.emitEvent(name, 'error', error);
    };
  }

  emitTouch(name: string) {
    const data = this.templateData(name);
    data.wasEmitted = true;
  }

  async subscribe(name: string, listener?: TemplateListener): Promise<[Template | undefined, () => void]> {
    const data = this.templateData(name);

    if (!data.wasRequired) {
      this.invalidate();
      data.wasRequired = true;
    }

    ++data.requestsCount;
    if (!data.wasEmitted) {
      await this.lock.waitForNextUnlock();
    }

    let isSubscribed = true;
    const unsubscribe = () => {
      if (isSubscribed) {
        isSubscribed = false;

        const ts = Date.now() + 3000;
        data.expiringRequests.push(ts);
        data.expiringRequests.sort();

        if (listener !== undefined) {
          data.listeners.delete(listener);
        }
      } else {
        throw new Error('This subscription is not active');
      }
    };

    if (listener !== undefined) {
      data.listeners.add(listener);
    }

    return [data.template, unsubscribe];
  }
}
