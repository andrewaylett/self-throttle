# Self-Throttle User Guide

As a service client, there's little point in sending requests to the service that we can be reasonably sure will fail.
Once we start seeing remote failures, we'll only send 1.2x the number of successes observed over the past minute.

Self-Throttle is Promise-based, and provides two methods for throttling calls:

```javascript
// A SelfThrottle object scopes throttling -- create one per service you call
const throttle = new SelfThrottle();

// We can throttle individual calls
// this will call the function and record the promise it returns
await throttle.attempt(() => functionReturningAPromise(123));

// We can wrap a function for re-use
const throttledFunction = throttle.wrap(functionReturningAPromise);
await throttledFunction(456);
await throttledFunction(789);
```
