/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ChatItem, ChatItemAction, ChatItemType, FeedbackPayload } from '@aws/mynah-ui'
import { ExtensionMessage } from '../commands'
import { TabType, TabsStorage } from '../storages/tabsStorage'
import { CodeReference } from './amazonqCommonsConnector'
import { FollowUpGenerator } from '../followUps/generator'

interface ChatPayload {
    chatMessage: string
}

export interface ConnectorProps {
    sendMessageToExtension: (message: ExtensionMessage) => void
    onMessageReceived?: (tabID: string, messageData: any, needToShowAPIDocsTab: boolean) => void
    onAsyncEventProgress: (tabID: string, inProgress: boolean, message: string) => void
    onChatAnswerReceived?: (tabID: string, message: ChatItem) => void
    onUpdateChatAnswerReceived?: (tabID: string, message: ChatItem) => void
    sendFeedback?: (tabId: string, feedbackPayload: FeedbackPayload) => void | undefined
    onError: (tabID: string, message: string, title: string) => void
    onWarning: (tabID: string, message: string, title: string) => void
    onUpdatePlaceholder: (tabID: string, newPlaceholder: string) => void
    onChatInputEnabled: (tabID: string, enabled: boolean) => void
    onUpdateAuthentication: (refactorEnabled: boolean, authenticatingTabIDs: string[]) => void
    onNewTab: (tabType: TabType) => void
    tabsStorage: TabsStorage
}

export class Connector {
    private readonly sendMessageToExtension
    private readonly onError
    private readonly onWarning
    private readonly onChatAnswerReceived
    private readonly onUpdateChatAnswerReceived
    private readonly onAsyncEventProgress
    private readonly updatePlaceholder
    private readonly chatInputEnabled
    private readonly onUpdateAuthentication
    private readonly followUpGenerator: FollowUpGenerator
    private readonly onNewTab

    constructor(props: ConnectorProps) {
        this.sendMessageToExtension = props.sendMessageToExtension
        this.onChatAnswerReceived = props.onChatAnswerReceived
        this.onUpdateChatAnswerReceived = props.onUpdateChatAnswerReceived
        this.onWarning = props.onWarning
        this.onError = props.onError
        this.onAsyncEventProgress = props.onAsyncEventProgress
        this.updatePlaceholder = props.onUpdatePlaceholder
        this.chatInputEnabled = props.onChatInputEnabled
        this.onUpdateAuthentication = props.onUpdateAuthentication
        this.followUpGenerator = new FollowUpGenerator()
        this.onNewTab = props.onNewTab
    }

    onCodeInsertToCursorPosition = (
        tabID: string,
        code?: string,
        type?: 'selection' | 'block',
        codeReference?: CodeReference[]
    ): void => {
        this.sendMessageToExtension({
            tabID: tabID,
            code,
            command: 'insert_code_at_cursor_position',
            codeReference,
            tabType: 'refactor',
        })
    }

    onCopyCodeToClipboard = (
        tabID: string,
        code?: string,
        type?: 'selection' | 'block',
        codeReference?: CodeReference[]
    ): void => {
        this.sendMessageToExtension({
            tabID: tabID,
            code,
            command: 'code_was_copied_to_clipboard',
            codeReference,
            tabType: 'refactor',
        })
    }

    onOpenDiff = (tabID: string, filePath: string, deleted: boolean): void => {
        this.sendMessageToExtension({
            command: 'open-diff',
            tabID,
            filePath,
            deleted,
            tabType: 'refactor',
        })
    }

    followUpClicked = (tabID: string, followUp: ChatItemAction): void => {
        this.sendMessageToExtension({
            command: 'follow-up-was-clicked',
            followUp,
            tabID,
            tabType: 'refactor',
        })
    }

    requestGenerativeAIAnswer = (tabID: string, payload: ChatPayload): Promise<any> =>
        new Promise((resolve, reject) => {
            this.sendMessageToExtension({
                tabID: tabID,
                command: 'chat-prompt',
                chatMessage: payload.chatMessage,
                tabType: 'refactor',
            })
        })

    private processChatMessage = async (messageData: any): Promise<void> => {
        if (this.onChatAnswerReceived !== undefined) {
            const answer: ChatItem = {
                type: messageData.messageType,
                body: messageData.message ?? undefined,
                messageId: messageData.messageId ?? messageData.triggerID ?? '',
                relatedContent: undefined,
                buttons: messageData.buttons,
                canBeVoted: messageData.canBeVoted,
                followUp: messageData.followUp,
            }
            this.onChatAnswerReceived(messageData.tabID, answer)
        }
    }

    private processChatMessageUpdate = async (messageData: any): Promise<void> => {
        if (this.onUpdateChatAnswerReceived !== undefined) {
            const answer: ChatItem = {
                type: messageData.messageType,
                body: messageData.message ?? undefined,
                messageId: messageData.messageId ?? messageData.triggerID ?? '',
                relatedContent: undefined,
                buttons: messageData.buttons,
                canBeVoted: messageData.canBeVoted,
                followUp: messageData.followUp,
            }
            this.onUpdateChatAnswerReceived(messageData.tabID, answer)
        }
    }

    private processAuthNeededException = async (messageData: any): Promise<void> => {
        if (this.onChatAnswerReceived === undefined) {
            return
        }

        this.onChatAnswerReceived(messageData.tabID, {
            type: ChatItemType.ANSWER,
            body: messageData.message,
            followUp: undefined,
            canBeVoted: false,
        })

        this.onChatAnswerReceived(messageData.tabID, {
            type: ChatItemType.ANSWER,
            body: undefined,
            followUp: this.followUpGenerator.generateAuthFollowUps('refactor', messageData.authType),
            canBeVoted: false,
        })

        return
    }

    handleMessageReceive = async (messageData: any): Promise<void> => {
        if (messageData.type === 'errorMessage') {
            this.onError(messageData.tabID, messageData.message, messageData.title)
            return
        }

        if (messageData.type === 'showInvalidTokenNotification') {
            this.onWarning(messageData.tabID, messageData.message, messageData.title)
            return
        }

        if (messageData.type === 'chatMessage') {
            await this.processChatMessage(messageData)
            return
        }

        if (messageData.type === 'updateMessage') {
            await this.processChatMessageUpdate(messageData)
            return
        }

        if (messageData.type === 'asyncEventProgressMessage') {
            this.onAsyncEventProgress(messageData.tabID, messageData.inProgress, messageData.message ?? undefined)
            return
        }

        if (messageData.type === 'updatePlaceholderMessage') {
            this.updatePlaceholder(messageData.tabID, messageData.newPlaceholder)
            return
        }

        if (messageData.type === 'chatInputEnabledMessage') {
            this.chatInputEnabled(messageData.tabID, messageData.enabled)
            return
        }

        if (messageData.type === 'authenticationUpdateMessage') {
            this.onUpdateAuthentication(messageData.refactorEnabled, messageData.authenticatingTabIDs)
            return
        }

        if (messageData.type === 'authNeededException') {
            await this.processAuthNeededException(messageData)
            return
        }

        if (messageData.type === 'openNewTabMessage') {
            this.onNewTab('refactor')
            return
        }
    }

    onStopChatResponse = (tabID: string): void => {
        this.sendMessageToExtension({
            tabID: tabID,
            command: 'stop-response',
            tabType: 'refactor',
        })
    }

    onTabOpen = (tabID: string): void => {
        this.sendMessageToExtension({
            tabID,
            command: 'new-tab-was-created',
            tabType: 'refactor',
        })
    }

    onTabRemove = (tabID: string): void => {
        this.sendMessageToExtension({
            tabID: tabID,
            command: 'tab-was-removed',
            tabType: 'refactor',
        })
    }

    sendFeedback = (tabId: string, feedbackPayload: FeedbackPayload): void | undefined => {
        this.sendMessageToExtension({
            tabID: tabId,
            command: 'chat-item-feedback',
            feedbackPayload,
            tabType: 'refactor',
        })
    }

    onChatItemVoted = (tabId: string, messageId: string, vote: string): void | undefined => {
        this.sendMessageToExtension({
            tabID: tabId,
            messageId: messageId,
            vote: vote,
            command: 'chat-item-voted',
            tabType: 'refactor',
        })
    }

    onResponseBodyLinkClick = (tabID: string, messageId: string, link: string): void => {
        this.sendMessageToExtension({
            command: 'response-body-link-click',
            tabID,
            messageId,
            link,
            tabType: 'refactor',
        })
    }

    onInBodyButtonClick = (tabID: string, messageId: string, action: any): void => {
        this.sendMessageToExtension({
            command: 'in-body-button-click',
            tabID,
            messageId,
            action,
            tabType: 'refactor',
        })
    }
}
