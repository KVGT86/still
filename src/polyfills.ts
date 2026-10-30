// webOS 22 uses Chromium 87. These two newer APIs are used by the shared client.
if (!Array.prototype.at)
  Object.defineProperty(Array.prototype, "at", {
    value: function (index: number) {
      const n = index < 0 ? this.length + index : index;
      return this[n];
    },
    writable: true,
    configurable: true,
  });
if (!AbortSignal.timeout)
  AbortSignal.timeout = (milliseconds: number) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), milliseconds);
    return controller.signal;
  };
