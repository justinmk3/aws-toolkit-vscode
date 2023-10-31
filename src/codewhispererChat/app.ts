/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { EventEmitter } from 'vscode'
import { ChatController as CwChatController } from '../codewhispererChat/controllers/chat/controller'
import { UIMessageListener } from './view/messages/messageListener'
import { AwsQAppInitContext } from '../awsq/apps/initContext'
import { MessageListener } from '../awsq/messages/messageListener'
import { MessagePublisher } from '../awsq/messages/messagePublisher'
import {
    InsertCodeAtCursorPosition,
    PromptMessage,
    StopResponseMessage,
    TabClosedMessage,
    TriggerTabIDReceived,
} from './controllers/chat/model'
import { EditorContextCommand, registerCommands } from './commands/registerCommands'

export function init(appContext: AwsQAppInitContext) {
    const cwChatControllerEventEmitters = {
        processPromptChatMessage: new EventEmitter<PromptMessage>(),
        processTabClosedMessage: new EventEmitter<TabClosedMessage>(),
        processInsertCodeAtCursorPosition: new EventEmitter<InsertCodeAtCursorPosition>(),
        processContextMenuCommand: new EventEmitter<EditorContextCommand>(),
        processTriggerTabIDReceived: new EventEmitter<TriggerTabIDReceived>(),
        processStopResponseMessage: new EventEmitter<StopResponseMessage>(),
    }

    const cwChatControllerMessageListeners = {
        processPromptChatMessage: new MessageListener<PromptMessage>(
            cwChatControllerEventEmitters.processPromptChatMessage
        ),
        processTabClosedMessage: new MessageListener<TabClosedMessage>(
            cwChatControllerEventEmitters.processTabClosedMessage
        ),
        processInsertCodeAtCursorPosition: new MessageListener<InsertCodeAtCursorPosition>(
            cwChatControllerEventEmitters.processInsertCodeAtCursorPosition
        ),
        processContextMenuCommand: new MessageListener<EditorContextCommand>(
            cwChatControllerEventEmitters.processContextMenuCommand
        ),
        processTriggerTabIDReceived: new MessageListener<TriggerTabIDReceived>(
            cwChatControllerEventEmitters.processTriggerTabIDReceived
        ),
        processStopResponseMessage: new MessageListener<StopResponseMessage>(
            cwChatControllerEventEmitters.processStopResponseMessage
        ),
    }

    const cwChatControllerMessagePublishers = {
        processPromptChatMessage: new MessagePublisher<PromptMessage>(
            cwChatControllerEventEmitters.processPromptChatMessage
        ),
        processTabClosedMessage: new MessagePublisher<TabClosedMessage>(
            cwChatControllerEventEmitters.processTabClosedMessage
        ),
        processInsertCodeAtCursorPosition: new MessagePublisher<InsertCodeAtCursorPosition>(
            cwChatControllerEventEmitters.processInsertCodeAtCursorPosition
        ),
        processContextMenuCommand: new MessagePublisher<EditorContextCommand>(
            cwChatControllerEventEmitters.processContextMenuCommand
        ),
        processTriggerTabIDReceived: new MessagePublisher<TriggerTabIDReceived>(
            cwChatControllerEventEmitters.processTriggerTabIDReceived
        ),
        processStopResponseMessage: new MessagePublisher<StopResponseMessage>(
            cwChatControllerEventEmitters.processStopResponseMessage
        ),
    }

    new CwChatController(cwChatControllerMessageListeners, appContext.getAppsToWebViewMessagePublisher())

    const cwChatUIInputEventEmitter = new EventEmitter<any>()

    new UIMessageListener({
        chatControllerMessagePublishers: cwChatControllerMessagePublishers,
        webViewMessageListener: new MessageListener<any>(cwChatUIInputEventEmitter),
    })

    appContext.registerWebViewToAppMessagePublisher(new MessagePublisher<any>(cwChatUIInputEventEmitter), 'cwc')

    registerCommands(cwChatControllerMessagePublishers)
}