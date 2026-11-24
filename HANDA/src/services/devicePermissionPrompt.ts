let promptQueue: Promise<void> = Promise.resolve();

export function queueDevicePermissionPrompt<T>(request: () => Promise<T>): Promise<T> {
  const result = promptQueue.then(request, request);
  promptQueue = result.then(() => undefined, () => undefined);
  return result;
}
