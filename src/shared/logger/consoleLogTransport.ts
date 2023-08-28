/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import Transport from 'winston-transport'
import globals from '../extensionGlobals'

const MESSAGE = Symbol.for('message') // eslint-disable-line @typescript-eslint/naming-convention

export interface LogEntry {
    level: string
    message: string
    [MESSAGE]: string
}

/**
 * Logger transport that sends log statements to console.log. Useful in web-browser mode, or for testing.
 */
export class ConsoleLogTransport extends Transport {
    public constructor() {
        super()
    }

    public override log(info: LogEntry, next: () => void): void {
        globals.clock.setImmediate(() => {
            this.emit('logged', info)
            console.log(info[MESSAGE])
        })

        next()
    }
}
