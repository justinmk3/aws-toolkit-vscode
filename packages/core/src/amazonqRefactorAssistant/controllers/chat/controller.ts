/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from 'vscode'
import { EventEmitter } from 'vscode'
import { AuthController } from '../../../amazonq/auth/controller'
import * as authUtil from '../../../codewhisperer/util/authUtil'
import { getLogger } from '../../../shared/logger'
import { ChatSessionStorage } from '../../storage/chatSession'
import { Messenger } from './messenger/messenger'
import { pdfName } from '../../constants'
import { RefactorAssistantClient } from '../../client/refactorAssistant'
import { fsCommon } from '../../../srcShared/fs'

export interface ChatControllerEventEmitters {
    readonly processHumanChatMessage: EventEmitter<any>
    readonly processResponseBodyLinkClick: EventEmitter<any>
    readonly processInBodyButtonClick: EventEmitter<any>
    readonly authClicked: EventEmitter<any>
    readonly stopResponse: EventEmitter<any>
    readonly removeTab: EventEmitter<any>
    readonly authChanged: EventEmitter<any>
}

export class RefactorAssistantController {
    readonly messenger: Messenger
    private readonly sessionStorage: ChatSessionStorage
    private authController: AuthController
    private readonly proxyClient: RefactorAssistantClient

    public constructor(
        private readonly chatControllerMessageListeners: ChatControllerEventEmitters,
        onDidChangeAmazonQVisibility: vscode.Event<boolean>,
        messenger: Messenger,
        sessionStorage: ChatSessionStorage,
        proxyClient: RefactorAssistantClient
    ) {
        this.messenger = messenger
        this.sessionStorage = sessionStorage
        this.authController = new AuthController()
        this.proxyClient = proxyClient

        this.chatControllerMessageListeners.processHumanChatMessage.event(data => {
            this.processUserChatMessage(data).catch(e => {
                getLogger().error('processUserChatMessage failed: %s', (e as Error).message)
            })
        })

        this.chatControllerMessageListeners.processResponseBodyLinkClick.event(async data => {
            // TODO: Add processing of different types of links if we add those to output (e.g., URLs, text files, etc.)
            await this.displayMarkdownLink(data.link)
        })

        this.chatControllerMessageListeners.processInBodyButtonClick.event(async data => {
            await this.processButtonClick(data)
        })

        this.chatControllerMessageListeners.authClicked.event(data => {
            this.authClicked(data)
        })

        this.chatControllerMessageListeners.stopResponse.event(async data => {
            await this.stopResponse(data)
        })

        this.chatControllerMessageListeners.removeTab.event(async data => {
            await this.removeTab(data)
        })

        this.chatControllerMessageListeners.authChanged.event(async data => {
            await this.handleAuthChanged(data)
        })
    }

    private authClicked(message: any) {
        this.authController.handleAuth(message.authType)

        this.messenger.sendAnswer({
            type: 'answer',
            tabID: message.tabID,
            message: 'Follow instructions to re-authenticate',
        })

        // Explicitly ensure the user goes through the re-authenticate flow
        this.messenger.sendChatInputEnabled(message.tabID, false)
    }

    private async handleAuthChanged(message: any) {
        const tabIds = this.sessionStorage.getSessionIds()

        for (const tabId of tabIds) {
            const session = await this.sessionStorage.getSession(tabId)
            await session.authChanged(message.authenticated)
            if (!message.authenticated) {
                const authState = await authUtil.getChatAuthState()
                await this.messenger.sendAuthNeededExceptionMessage(authState, tabId)
            } else {
                this.messenger.sendChatInputEnabled(tabId, true)
            }
        }
    }

    private async processButtonClick(message: any) {
        switch (message?.action?.id) {
            case 'download-pdf':
                await this.downloadFile(message)
                break
        }
    }

    private async downloadFile(message: any) {
        const session = await this.sessionStorage.getSession(message.tabId)

        const saveOptions: vscode.SaveDialogOptions = {
            defaultUri: vscode.Uri.parse(pdfName(session.stateConfig.assessmentId)),
        }

        void vscode.window.showSaveDialog(saveOptions).then(async fileUri => {
            if (fileUri) {
                const plan = await this.proxyClient.downloadPlan(
                    session.stateConfig.engagementId,
                    session.stateConfig.assessmentId
                )
                await fsCommon.writeFile(fileUri.fsPath, plan)
            }
        })
    }

    private async processUserChatMessage(message: any) {
        if (!message.message) {
            throw new Error(`Invalid message: ${message.message}`)
        }

        const session = await this.sessionStorage.getSession(message.tabID)
        const authState = await authUtil.getChatAuthState()
        if (authState.amazonQ !== 'connected') {
            await this.messenger.sendAuthNeededExceptionMessage(authState, message.tabID)
            session.isAuthenticating = true
            return
        }

        await session.send(message.message)
    }

    private async displayMarkdownLink(link: any) {
        await vscode.commands.executeCommand('markdown.showPreview', vscode.Uri.parse(link))
    }

    private async stopResponse(message: any) {
        const session = await this.sessionStorage.getSession(message.tabID)
        await session.cancel()
    }

    private async removeTab(message: any) {
        this.sessionStorage.deleteSession(message.tabId)
    }
}
