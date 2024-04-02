/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import { ChatItemButton } from '@aws/mynah-ui/dist/static'
import {
    ChatMessage,
    ChatMessageUpdate,
    AsyncEventProgressMessage,
    UpdatePlaceholderMessage,
    AuthNeededException,
    ChatInputEnabledMessage,
    AuthenticationUpdateMessage,
} from '../../../views/connector/connector'
import { AppToWebViewMessageDispatcher } from '../../../views/connector/connector'
import { ChatItemAction } from '@aws/mynah-ui'
import { FeatureAuthState } from '../../../../codewhisperer/util/authUtil'
import { AuthFollowUpType, expiredText, enableQText, reauthenticateText } from '../../../../amazonq/auth/model'

export class Messenger {
    public constructor(private readonly dispatcher: AppToWebViewMessageDispatcher) {}

    public sendAnswer(params: {
        message?: string
        messageId?: string
        type: 'answer' | 'answer-part' | 'answer-stream' | 'system-prompt'
        followUp?: {
            text?: string
            options?: ChatItemAction[]
        }
        tabID: string
        canBeVoted?: boolean
        buttons?: ChatItemButton[]
    }) {
        this.dispatcher.sendChatMessage(
            new ChatMessage(
                {
                    message: params.message,
                    messageId: params.messageId,
                    messageType: params.type,
                    followUp: params.followUp,
                    relatedSuggestions: undefined,
                    canBeVoted: params.canBeVoted ?? false,
                    buttons: params.buttons,
                },
                params.tabID
            )
        )
    }

    public updateAnswer(params: {
        message?: string
        messageId: string
        type: 'answer' | 'answer-part' | 'answer-stream' | 'system-prompt'
        followUp?: {
            text?: string
            options?: ChatItemAction[]
        }
        tabID: string
        canBeVoted?: boolean
        buttons?: ChatItemButton[]
    }) {
        this.dispatcher.sendChatMessageUpdate(
            new ChatMessageUpdate(
                {
                    message: params.message,
                    messageId: params.messageId,
                    messageType: params.type,
                    followUp: params.followUp,
                    relatedSuggestions: undefined,
                    canBeVoted: params.canBeVoted ?? false,
                    buttons: params.buttons,
                },
                params.tabID
            )
        )
    }

    public sendAsyncEventProgress(tabID: string, inProgress: boolean, message: string | undefined) {
        this.dispatcher.sendAsyncEventProgress(new AsyncEventProgressMessage(tabID, inProgress, message))
    }

    public sendUpdatePlaceholder(tabID: string, newPlaceholder: string) {
        this.dispatcher.sendPlaceholder(new UpdatePlaceholderMessage(tabID, newPlaceholder))
    }

    public sendInitalStream(tabID: string, messageId: string, message: string | undefined) {
        this.dispatcher.sendChatMessage(
            new ChatMessage(
                {
                    messageType: 'answer-stream',
                    message,
                    messageId: messageId,
                    followUp: undefined,
                    relatedSuggestions: undefined,
                    canBeVoted: false,
                    buttons: undefined,
                },
                tabID
            )
        )
    }

    public sendAuthenticationUpdate(refactorEnabled: boolean, authenticatingTabIDs: string[]) {
        this.dispatcher.sendAuthenticationUpdate(new AuthenticationUpdateMessage(refactorEnabled, authenticatingTabIDs))
    }

    public async sendAuthNeededExceptionMessage(credentialState: FeatureAuthState, tabID: string) {
        let authType: AuthFollowUpType = 'full-auth'
        let message = reauthenticateText
        if (credentialState.amazonQ === 'disconnected') {
            authType = 'full-auth'
            message = reauthenticateText
        }

        if (credentialState.amazonQ === 'unsupported') {
            authType = 'use-supported-auth'
            message = enableQText
        }

        if (credentialState.amazonQ === 'expired') {
            authType = 're-auth'
            message = expiredText
        }

        this.dispatcher.sendAuthNeededExceptionMessage(new AuthNeededException(message, authType, tabID))
    }

    public sendChatInputEnabled(tabID: string, enabled: boolean) {
        this.dispatcher.sendChatInputEnabled(new ChatInputEnabledMessage(tabID, enabled))
    }
}
