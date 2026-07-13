export function runDeduplicatedRequest<T>(
  key: string,
  requests: Map<string, Promise<T>>,
  operation: () => Promise<T>,
): Promise<T> {
  const pending = requests.get(key);
  if (pending) return pending;

  const request = operation().finally(() => {
    if (requests.get(key) === request) requests.delete(key);
  });
  requests.set(key, request);
  return request;
}
