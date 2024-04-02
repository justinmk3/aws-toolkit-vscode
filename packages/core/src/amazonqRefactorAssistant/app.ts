/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from 'vscode'
import { UIMessageListener } from './views/actions/uiMessageListener'
import { ChatControllerEventEmitters, RefactorAssistantController } from './controllers/chat/controller'
import { AmazonQAppInitContext } from '../amazonq/apps/initContext'
import { MessagePublisher } from '../amazonq/messages/messagePublisher'
import { MessageListener } from '../amazonq/messages/messageListener'
import { Messenger } from './controllers/chat/messenger/messenger'
import { AppToWebViewMessageDispatcher } from './views/connector/connector'
import { ChatSessionStorage } from './storage/chatSession'
import { fromQueryToParameters } from '../shared/utilities/uriUtils'
import { getLogger } from '../shared/logger/logger'
import globals from '../shared/extensionGlobals'
import { refactorAssistantScheme } from './constants'
import { debounce } from 'lodash'
import { AuthUtil, getChatAuthState } from '../codewhisperer/util/authUtil'

export function init(appContext: AmazonQAppInitContext) {
    const refactorAssistantEventEmitters: ChatControllerEventEmitters = {
        processHumanChatMessage: new vscode.EventEmitter<any>(),
        processResponseBodyLinkClick: new vscode.EventEmitter<any>(),
        processInBodyButtonClick: new vscode.EventEmitter<any>(),
        authClicked: new vscode.EventEmitter<any>(),
        stopResponse: new vscode.EventEmitter<any>(),
        removeTab: new vscode.EventEmitter<any>(),
    }

    const messenger = new Messenger(new AppToWebViewMessageDispatcher(appContext.getAppsToWebViewMessagePublisher()))
    const sessionStorage = new ChatSessionStorage(messenger)

    new RefactorAssistantController(
        refactorAssistantEventEmitters,
        appContext.onDidChangeAmazonQVisibility.event,
        messenger,
        sessionStorage
    )

    const refactorAssistantProvider = new (class implements vscode.TextDocumentContentProvider {
        async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
            const params = fromQueryToParameters(uri.query)

            const tabID = params.get('tabID')
            if (!tabID) {
                getLogger().error(`Unable to find tabID from ${uri.toString()}`)
                throw new Error(`Unable to find tabID from ${uri.toString()}`)
            }

            const session = await sessionStorage.getSession(tabID)
            const content = await session.config.fs.readFile(uri)
            const decodedContent = new TextDecoder().decode(content)
            return decodedContent
        }
    })()

    const textDocumentProvider = vscode.workspace.registerTextDocumentContentProvider(
        refactorAssistantScheme,
        refactorAssistantProvider
    )

    globals.context.subscriptions.push(textDocumentProvider)

    const refactorAssistantInputEventEmitter = new vscode.EventEmitter<any>()

    new UIMessageListener({
        chatControllerEventEmitters: refactorAssistantEventEmitters,
        webViewMessageListener: new MessageListener<any>(refactorAssistantInputEventEmitter),
    })

    appContext.registerWebViewToAppMessagePublisher(
        new MessagePublisher<any>(refactorAssistantInputEventEmitter),
        'refactor'
    )

    // Notifies all unauthenticated tabs that the user has authenticated
    const debouncedEvent = debounce(async () => {
        const authenticated = (await getChatAuthState()).amazonQ === 'connected'
        let authenticatingSessionIDs: string[] = []
        if (authenticated) {
            const authenticatingSessions = sessionStorage.getAuthenticatingSessions()

            authenticatingSessionIDs = authenticatingSessions.map(session => session.tabID)

            // We've already authenticated these sessions
            authenticatingSessions.forEach(session => (session.isAuthenticating = false))
        }

        messenger.sendAuthenticationUpdate(authenticated, authenticatingSessionIDs)
    }, 500)

    AuthUtil.instance.secondaryAuth.onDidChangeActiveConnection(() => {
        return debouncedEvent()
    })
}
