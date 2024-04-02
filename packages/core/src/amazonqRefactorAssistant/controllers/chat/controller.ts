/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from 'vscode'
import { EventEmitter } from 'vscode'
import { getLogger } from '../../../shared/logger'
import { ChatSessionStorage } from '../../storage/chatSession'
import * as authUtil from '../../../codewhisperer/util/authUtil'
import { Messenger } from './messenger/messenger'
import { AuthController } from '../../../amazonq/auth/controller'
import { defaultPdfName } from '../../constants'

export interface ChatControllerEventEmitters {
    readonly processHumanChatMessage: EventEmitter<any>
    readonly processResponseBodyLinkClick: EventEmitter<any>
    readonly processInBodyButtonClick: EventEmitter<any>
    readonly authClicked: EventEmitter<any>
    readonly stopResponse: EventEmitter<any>
    readonly removeTab: EventEmitter<any>
}

export class RefactorAssistantController {
    readonly messenger: Messenger
    private readonly sessionStorage: ChatSessionStorage
    private authController: AuthController

    public constructor(
        private readonly chatControllerMessageListeners: ChatControllerEventEmitters,
        onDidChangeAmazonQVisibility: vscode.Event<boolean>,
        messenger: Messenger,
        sessionStorage: ChatSessionStorage
    ) {
        this.messenger = messenger
        this.sessionStorage = sessionStorage
        this.authController = new AuthController()

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

    private async processButtonClick(message: any) {
        switch (message?.action?.id) {
            case 'download-pdf':
                await this.downloadFile(defaultPdfName)
                break
        }
    }

    private async downloadFile(defaultFileName: string) {
        const saveOptions: vscode.SaveDialogOptions = {
            defaultUri: vscode.Uri.parse(defaultFileName),
        }

        void vscode.window.showSaveDialog(saveOptions).then(async fileUri => {
            if (fileUri) {
                // TODO: ConversationId should be retrieved from session state
                // TODO: Uncomment this when downloading is done via a URL and doesn't require RefactorClient
                //await downloadFile(this.conversationId, fileUri.fsPath)
            }
        })
    }

    private async processUserChatMessage(message: any) {
        /**
         * Don't attempt to process any chat messages when a workspace folder is not set.
         * When the tab is first opened we will throw an error and lock the chat if the workspace
         * folder is not found
         */

        const workspaceFolders = vscode.workspace.workspaceFolders
        if (workspaceFolders === undefined || workspaceFolders.length === 0) {
            return
        }

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
