/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from 'vscode'
import { ConsoleLogTransport } from '../../shared/logger/consoleLogTransport'
import { Logger, LogLevel, compareLogLevel, ConsoleLogger } from '../../shared/logger/logger'
import { OutputChannelTransport, Transport } from '../../shared/logger/outputChannelTransport'
import { isSourceMappingAvailable } from '../../shared/vscode/env'
import { formatError, ToolkitError, UnknownError } from '../../shared/errors'

// Need to limit how many logs are actually tracked
// LRU cache would work well, currently it just dumps the least recently added log
const logmapSize: number = 1000
export class WinstonToolkitLogger implements Logger, vscode.Disposable {
    private readonly logger: ConsoleLogger
    private disposed: boolean = false
    private idCounter: number = 0
    private logMap: { [logID: number]: { [filePath: string]: string } } = {}
    private logLevel: LogLevel = 'info'
    private transports: Transport[] = []

    public constructor(logLevel: LogLevel) {
        this.logger = new ConsoleLogger()
    }

    public setLogLevel(logLevel: LogLevel) {
        if (this.logLevel === logLevel) {
            return
        }
        // Log calls are made with explicit levels to ensure the text is output
        this.logLevel = logLevel
        this.logger.info(this.logLevel, `Log level: ${this.logLevel}`)
    }

    public logLevelEnabled(logLevel: LogLevel): boolean {
        return compareLogLevel(this.logLevel, logLevel) >= 0
    }

    // TODO: hoist this
    public logToFile(logPath: string): void {
        this.logger.warn('logToFile not implemented')
    }

    public logToOutputChannel(outputChannel: vscode.OutputChannel, stripAnsi: boolean): void {
        const outputChannelTransport = new OutputChannelTransport({
            outputChannel,
            stripAnsi,
        })
        this.transports.push(outputChannelTransport)
        // const channelUri: vscode.Uri = vscode.Uri.parse(`channel://${outputChannel.name}`)
        // outputChannelTransport.on('logged', (obj: any) => this.parseLogObject(channelUri, obj))
        // this.logger.add(outputChannelTransport)
    }

    public logToConsole(): void {
        const consoleLogTransport = new ConsoleLogTransport()
        this.transports.push(consoleLogTransport as any) // TODO
        // const logConsoleUri: vscode.Uri = vscode.Uri.parse('console://log')
        // consoleLogTransport.on('logged', (obj: any) => this.parseLogObject(logConsoleUri, obj))
        // this.logger.add(consoleLogTransport)
    }

    public debug(message: string | Error, ...meta: any[]): number {
        return this.writeToLogs('debug', message, ...meta)
    }

    public verbose(message: string | Error, ...meta: any[]): number {
        return this.writeToLogs('verbose', message, ...meta)
    }

    public info(message: string | Error, ...meta: any[]): number {
        return this.writeToLogs('info', message, ...meta)
    }

    public warn(message: string | Error, ...meta: any[]): number {
        return this.writeToLogs('warn', message, ...meta)
    }

    public error(message: string | Error, ...meta: any[]): number {
        return this.writeToLogs('error', message, ...meta)
    }

    public dispose(): Promise<void> {
        return this.disposed
            ? Promise.resolve()
            : new Promise<void>(resolve => {
                  this.disposed = true
                  for (const t of this.transports) {
                      if (t.close) {
                          t.close()
                      }
                  }
              })
    }

    private mapError(level: LogLevel, err: Error): Error | string {
        // Use ToolkitError.trace even if we have source mapping (see below), because:
        // 1. it is what users will see, we want visibility into that when debugging
        // 2. it is often more useful than the stacktrace anyway
        if (err instanceof ToolkitError) {
            return err.trace
        }

        if (isSourceMappingAvailable() && level === 'error') {
            return err
        }

        return formatError(UnknownError.cast(err))
    }

    private writeToLogs(level: LogLevel, message: string | Error, ...meta: any[]): number {
        if (this.disposed) {
            throw new Error('Cannot write to disposed logger')
        }

        meta = meta.map(o => (o instanceof Error ? this.mapError(level, o) : o))

        if (level === 'debug') {
            this.logger.debug(level, message, ...meta, { logID: this.idCounter })
        } else if (level === 'verbose') {
            this.logger.verbose(level, message, ...meta, { logID: this.idCounter })
        } else if (level === 'info') {
            this.logger.info(level, message, ...meta, { logID: this.idCounter })
        } else if (level === 'warn') {
            this.logger.warn(level, message, ...meta, { logID: this.idCounter })
        } else if (level === 'error') {
            this.logger.error(level, message, ...meta, { logID: this.idCounter })
        }

        this.logMap[this.idCounter % logmapSize] = {}
        return this.idCounter++
    }

    /**
     * Attempts to get the mapped message corresponding to the provided file and logID.
     * Log messages are considered 'stale' after a constant amount of new logs have been added.
     *
     * @param logID  Unique ID associated with every log operation
     * @param file  Desired output file Uri. Debug console uses the uri 'console://debug' and output channel uses 'channel://output'
     *
     * @returns  Final log message. Stale or non-existant logs return undefined
     */
    public getLogById(logID: number, file: vscode.Uri): string | undefined {
        // Not possible, yell at the caller :(
        if (logID >= this.idCounter || logID < 0) {
            throw new Error(`Invalid log state, logID=${logID} must be in the range [0, ${this.idCounter})!`)
        }

        // This prevents callers from getting stale logs
        if (this.idCounter - logID > logmapSize) {
            return undefined
        }

        if (this.logMap[logID % logmapSize]) {
            return this.logMap[logID % logmapSize][file.toString(true)]
        }
    }
}
