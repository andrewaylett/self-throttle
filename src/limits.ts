/*
 * Copyright 2020-2022 Andrew Aylett
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

class Unlimited {
    readonly isLimited = false as const;
}
class Limited {
    constructor(limit: number, rate: number) {
        this.limit = limit;
        this.rate = rate;
    }
    readonly isLimited = true as const;
    readonly limit: number;
    readonly rate: number;
}

export type Limit = Unlimited | Limited;
export const Limit = {
    unlimited: new Unlimited(),
    limited: ({ limit, rate }: { limit: number; rate: number }) =>
        new Limited(limit, rate),
};
