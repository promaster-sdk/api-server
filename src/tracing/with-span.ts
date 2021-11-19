import * as api from "@opentelemetry/api";
// Re-export Span for our clients to use
type Span = api.Span;
export { Span };

/**
 * Create a new span, make it the active span on a new context and execute the provided
 * function within that context
 */
export function withSpan<T extends (span: Span) => ReturnType<T>>(operationName: string, fn: T): ReturnType<T> {
  const tracer = api.trace.getTracer("default");
  const span = tracer.startSpan(operationName);
  const ctx = api.trace.setSpan(api.context.active(), span);
  const fn2 = (): ReturnType<T> => {
    const result = fn(span);
    // The result might be a promise but there is no safe way to tell,
    // instead convert the value to something that we know for sure is a promise
    const promise = Promise.resolve(result);
    promise.then(() => {
      // End the span when promise resolves
      // In case we wrapped a value it will be resolved directly
      if (span.isRecording()) {
        // log.jonas("Auto ended span with promise");
        span.end();
      }
    });
    return result;
  };
  return api.context.with(ctx, fn2);
}
