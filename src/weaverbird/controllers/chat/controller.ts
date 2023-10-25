/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from 'vscode'
import * as path from 'path'
import { existsSync } from 'fs'
import { EventEmitter } from 'vscode'
import { Messenger } from './messenger/messenger'
import { ChatSessionStorage } from '../../storages/chatSession'
import { FollowUpTypes, SessionStatePhase } from '../../types'
import { ChatItemFollowUp } from '@aws/mynah-ui-chat'
import { weaverbirdScheme } from '../../constants'

export interface ChatControllerEventEmitters {
    readonly processHumanChatMessage: EventEmitter<any>
    readonly followUpClicked: EventEmitter<any>
    readonly openDiff: EventEmitter<any>
    readonly stopResponse: EventEmitter<any>
    readonly tabClosed: EventEmitter<any>
}

export class WeaverbirdController {
    private readonly messenger: Messenger
    private readonly sessionStorage: ChatSessionStorage

    public constructor(
        private readonly chatControllerMessageListeners: ChatControllerEventEmitters,
        messenger: Messenger,
        sessionStorage: ChatSessionStorage
    ) {
        this.messenger = messenger
        this.sessionStorage = sessionStorage

        this.chatControllerMessageListeners.processHumanChatMessage.event(data => {
            this.processHumanChatMessage(data)
        })
        this.chatControllerMessageListeners.followUpClicked.event(data => {
            switch (data.followUp.type) {
                case FollowUpTypes.WriteCode:
                    this.writeCodeClicked(data)
                    break
                case FollowUpTypes.AcceptCode:
                    this.acceptCode(data)
                    break
                case FollowUpTypes.RejectCode:
                    // TODO figure out what we want to do here
                    break
            }
        })
        this.chatControllerMessageListeners.openDiff.event(data => {
            this.openDiff(data)
        })
        this.chatControllerMessageListeners.stopResponse.event(data => {
            this.stopResponse(data)
        })
        this.chatControllerMessageListeners.tabClosed.event(data => {
            this.tabClosed(data)
        })
    }

    // TODO add type
    private async processHumanChatMessage(message: any) {
        if (message.message == undefined) {
            this.messenger.sendErrorMessage('chatMessage should be set', message.tabID)
            return
        }

        this.messenger.sendResponse(async () => {
            const session = await this.sessionStorage.getSession(message.tabID)
            const interactions = await session.send(message.message)
            return {
                message: interactions.content,
                followUps: this.getFollowUpOptions(session.state.phase),
            }
        }, message.tabID)
    }

    // TODO add type
    private async writeCodeClicked(message: any) {
        // lock the UI/show loading bubbles
        this.messenger.sendCodeGeneration(message.tabID, true)
        const session = await this.sessionStorage.getSession(message.tabID)

        let filePaths: string[] = []
        try {
            filePaths = await session.startCodegen()
        } catch (err: any) {
            const errorMessage = `Weaverbird API request failed: ${err.cause?.message ?? err.message}`
            this.messenger.sendErrorMessage(errorMessage, message.tabID)
        }

        // unlock the UI
        this.messenger.sendCodeGeneration(message.tabID, false)

        // send the file path changes
        if (filePaths.length > 0) {
            this.messenger.sendFilePaths(filePaths, message.tabID, session.state.conversationId ?? '')
        }

        // Only add the follow up when the tab hasn't been closed/request hasn't been cancelled
        if (!session.state.tokenSource.token.isCancellationRequested && filePaths.length > 0) {
            this.messenger.sendFollowUps(this.getFollowUpOptions(session.state.phase), message.tabID)
        }
    }

    // TODO add type
    private async acceptCode(message: any) {
        try {
            const session = await this.sessionStorage.getSession(message.tabID)
            await session.acceptChanges()
        } catch (err: any) {
            this.messenger.sendErrorMessage(`Failed to accept code changes: ${err.message}`, message.tabID)
        }
    }

    private getFollowUpOptions(phase: SessionStatePhase | undefined): ChatItemFollowUp[] {
        switch (phase) {
            case SessionStatePhase.Approach:
                return [
                    {
                        pillText: 'Write Code',
                        type: FollowUpTypes.WriteCode,
                    },
                ]
            case SessionStatePhase.Codegen:
                return [
                    {
                        pillText: 'Accept changes',
                        type: FollowUpTypes.AcceptCode,
                    },
                    {
                        pillText: 'Reject and discuss',
                        type: FollowUpTypes.RejectCode,
                    },
                ]
            default:
                return []
        }
    }

    private async openDiff(message: any) {
        const session = await this.sessionStorage.getSession(message.tabID)
        const workspaceRoot = session.config.workspaceRoot ?? ''
        const originalPath = path.join(workspaceRoot, message.rightPath)
        let left
        if (existsSync(originalPath)) {
            left = vscode.Uri.file(originalPath)
        } else {
            left = vscode.Uri.from({ scheme: weaverbirdScheme, path: 'empty', query: `tabID=${message.tabID}` })
        }

        vscode.commands.executeCommand(
            'vscode.diff',
            left,
            vscode.Uri.from({
                scheme: weaverbirdScheme,
                path: message.rightPath,
                query: `tabID=${message.tabID}`,
            })
        )
    }

    private async stopResponse(message: any) {
        const session = await this.sessionStorage.getSession(message.tabID)
        session.state.tokenSource.cancel()
    }

    private tabClosed(message: any) {
        this.sessionStorage.deleteSession(message.tabID)
    }
}