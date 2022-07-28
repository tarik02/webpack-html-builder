export class CompilerLock {
  private _isLocked = false;
  private listeners: Array<() => void> = [];

  get isLocked() {
    return this._isLocked;
  }

  lock() {
    if (this._isLocked) {
      throw new Error('Compiler is already locked');
    }
    this._isLocked = true;
  }

  unlock() {
    if (!this._isLocked) {
      throw new Error('Compiler is not locked');
    }
    this._isLocked = false;

    for (const listener of this.listeners) {
      Promise.resolve()
        .then(() => listener())
        .catch(console.error);
    }
    this.listeners = [];
  }

  waitForReady(): Promise<void> {
    if (!this._isLocked) {
      return Promise.resolve();
    }
    return new Promise(resolve => this.listeners.push(resolve));
  }

  waitForNextUnlock(): Promise<void> {
    return new Promise(resolve => this.listeners.push(resolve));
  }
}
