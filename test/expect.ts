import { ExpectationResult, extend, MatcherState } from 'extend-expect';
import { SelfThrottle, SelfThrottleError } from 'self-throttle';

export const SUCCEED = Symbol('SUCCEED');
export const FAIL = Symbol('FAIL');
export const DECLINE = Symbol('DECLINE');
export type Attempt = typeof SUCCEED | typeof FAIL | typeof DECLINE;

async function throttlesTo(
    this: MatcherState,
    instance: unknown,
    ...expected: unknown[]
): Promise<ExpectationResult> {
    const options = {
        comment: 'Response matching',
        isNot: this.isNot,
        promise: this.promise,
    };
    const matcherHint = this.utils.matcherHint(
        'throttlesTo',
        'SelfThrottle',
        'Invocation Options',
        options,
    );

    if (!(instance instanceof SelfThrottle)) {
        return {
            pass: false,
            message: () =>
                this.utils.matcherErrorMessage(
                    matcherHint,
                    `${this.utils.RECEIVED_COLOR(
                        'received',
                    )} value must be a SelfThrottle`,
                    this.utils.printWithType(
                        'received',
                        instance,
                        this.utils.printReceived,
                    ),
                ),
        };
    }

    if (expected.length != 4) {
        return {
            pass: false,
            message(): string {
                return 'Expected four values to match';
            },
        };
    }

    const [timestamp, attempt, successes, failures] = expected;

    if (
        typeof timestamp !== 'number' ||
        typeof successes !== 'number' ||
        typeof failures !== 'number'
    ) {
        return {
            pass: false,
            message: () =>
                this.utils.matcherErrorMessage(
                    matcherHint,
                    'timestamp, successes, and failures parameters must be numbers',
                ),
        };
    }

    const wrapped = instance.wrap((arg: Promise<number>) => arg);

    switch (attempt) {
        case SUCCEED: {
            try {
                const stamp = await wrapped(Promise.resolve(timestamp));
                const pass =
                    stamp === timestamp &&
                    instance.successes === successes + 1 &&
                    instance.failures === failures;
                return {
                    pass,
                    message: () =>
                        this.utils.matcherErrorMessage(
                            matcherHint,
                            'Expected this request to succeed',
                            this.utils.stringify({
                                instance,
                                stamp,
                                timestamp,
                                attempt,
                                successes,
                                failures,
                            }),
                        ),
                };
            } catch (error) {
                return {
                    pass: false,
                    message: () =>
                        this.utils.matcherErrorMessage(
                            matcherHint,
                            'Expected this request to succeed',
                            this.utils.stringify({
                                instance,
                                exception: error,
                                timestamp,
                                attempt,
                                successes,
                                failures,
                            }),
                        ),
                };
            }
        }
        case FAIL: {
            try {
                const stamp = await wrapped(Promise.reject(timestamp));
                return {
                    pass: false,
                    message: () =>
                        this.utils.matcherErrorMessage(
                            matcherHint,
                            'Fail unexpectedly succeeded',
                            this.utils.stringify({
                                instance,
                                stamp,
                                timestamp,
                                attempt,
                                successes,
                                failures,
                            }),
                        ),
                };
            } catch (error) {
                const pass =
                    error === timestamp &&
                    instance.successes === successes &&
                    instance.failures === failures + 1;
                return {
                    pass,
                    message: () =>
                        this.utils.matcherErrorMessage(
                            matcherHint,
                            'Expected this request to fail',
                            this.utils.stringify({
                                instance,
                                exception: error,
                                timestamp,
                                attempt,
                                successes,
                                failures,
                            }),
                        ),
                };
            }
        }
        case DECLINE: {
            try {
                const stamp = await wrapped(Promise.resolve(timestamp));
                return {
                    pass: false,
                    message: () =>
                        this.utils.matcherErrorMessage(
                            matcherHint,
                            'Decline unexpectedly succeeded',
                            this.utils.stringify({
                                instance,
                                stamp,
                                timestamp,
                                attempt,
                                successes,
                                failures,
                            }),
                        ),
                };
            } catch (error) {
                const pass =
                    error instanceof SelfThrottleError &&
                    instance.successes === successes &&
                    instance.failures === failures;
                return {
                    pass,
                    message: () =>
                        this.utils.matcherErrorMessage(
                            matcherHint,
                            'Expected this request to be declined',
                            this.utils.stringify({
                                instance,
                                exception: error,
                                timestamp,
                                attempt,
                                successes,
                                failures,
                            }),
                        ),
                };
            }
        }
        default: {
            return {
                pass: false,
                message: () =>
                    this.utils.matcherErrorMessage(
                        matcherHint,
                        `${this.utils.EXPECTED_COLOR(
                            'attempt',
                        )} value must be an Attempt`,
                        this.utils.printWithType(
                            'attempt',
                            attempt,
                            this.utils.printExpected,
                        ),
                    ),
            };
        }
    }
}

const customMatchers = {
    throttlesTo,
};

interface Extensions {
    throttlesTo(
        timestamp: number,
        attempt: Attempt,
        successes: number,
        failures: number,
    ): Promise<void>;
}

export const expect = extend<Extensions>(customMatchers);
