/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ChatItemButton } from '@aws/mynah-ui/dist/static'
import { MessagePublisher } from '../../../amazonq/messages/messagePublisher'
import { refactorAssistant } from '../../constants'
import { ChatItemType } from '../../models'
import { ChatItemAction, SourceLink } from '@aws/mynah-ui'
import { AuthFollowUpType } from '../../../amazonq/auth/model'

class UiMessage {
    readonly time: number = Date.now()
    readonly sender: string = refactorAssistant
    readonly type: string = ''

    public constructor(protected tabID: string) {}
}

export interface ChatMessageProps {
    readonly message: string | undefined
    readonly messageId: string | undefined
    readonly messageType: ChatItemType
    readonly followUp:
        | {
              text?: string
              options?: ChatItemAction[]
          }
        | undefined
    readonly relatedSuggestions: SourceLink[] | undefined
    readonly canBeVoted: boolean
    readonly buttons: ChatItemButton[] | undefined
}

export class AsyncEventProgressMessage extends UiMessage {
    readonly inProgress: boolean
    readonly message: string | undefined
    override type = 'asyncEventProgressMessage'

    constructor(tabID: string, inProgress: boolean, message: string | undefined) {
        super(tabID)
        this.inProgress = inProgress
        this.message = message
    }
}

export class UpdatePlaceholderMessage extends UiMessage {
    readonly newPlaceholder: string
    override type = 'updatePlaceholderMessage'

    constructor(tabID: string, newPlaceholder: string) {
        super(tabID)
        this.newPlaceholder = newPlaceholder
    }
}

export class AuthNeededException extends UiMessage {
    readonly message: string
    readonly authType: AuthFollowUpType
    override type = 'authNeededException'

    constructor(message: string, authType: AuthFollowUpType, tabID: string) {
        super(tabID)
        this.message = message
        this.authType = authType
    }
}

export class AuthenticationUpdateMessage {
    readonly time: number = Date.now()
    readonly sender: string = refactorAssistant
    readonly refactorEnabled: boolean
    readonly authenticatingTabIDs: string[]
    readonly type = 'authenticationUpdateMessage'

    constructor(refactorEnabled: boolean, authenticatingTabIDs: string[]) {
        this.refactorEnabled = refactorEnabled
        this.authenticatingTabIDs = authenticatingTabIDs
    }
}

export class ChatInputEnabledMessage extends UiMessage {
    readonly enabled: boolean
    override type = 'chatInputEnabledMessage'

    constructor(tabID: string, enabled: boolean) {
        super(tabID)
        this.enabled = enabled
    }
}

export class ChatMessage extends UiMessage {
    readonly message: string | undefined
    readonly messageId: string | undefined
    readonly messageType: ChatItemType
    readonly followUp:
        | {
              text?: string
              options?: ChatItemAction[]
          }
        | undefined
    readonly relatedSuggestions: SourceLink[] | undefined
    readonly canBeVoted: boolean
    readonly requestID!: string
    readonly buttons: ChatItemButton[] | undefined
    override type = 'chatMessage'

    constructor(props: ChatMessageProps, tabID: string) {
        super(tabID)
        this.message = props.message
        this.messageId = props.messageId
        this.messageType = props.messageType
        this.followUp = props.followUp
        this.relatedSuggestions = props.relatedSuggestions
        this.canBeVoted = props.canBeVoted
        this.buttons = props.buttons
    }
}

export class ChatMessageUpdate extends UiMessage {
    readonly message: string | undefined
    readonly messageId: string | undefined
    readonly messageType: ChatItemType
    readonly followUp:
        | {
              text?: string
              options?: ChatItemAction[]
          }
        | undefined
    readonly relatedSuggestions: SourceLink[] | undefined
    readonly canBeVoted: boolean
    readonly requestID!: string
    readonly buttons: ChatItemButton[] | undefined
    override type = 'updateMessage'

    constructor(props: ChatMessageProps, tabID: string) {
        super(tabID)
        this.message = props.message
        this.messageId = props.messageId
        this.messageType = props.messageType
        this.followUp = props.followUp
        this.relatedSuggestions = props.relatedSuggestions
        this.canBeVoted = props.canBeVoted
        this.buttons = props.buttons
    }
}

export class AppToWebViewMessageDispatcher {
    constructor(private readonly appsToWebViewMessagePublisher: MessagePublisher<any>) {}

    public sendChatMessage(message: ChatMessage) {
        this.appsToWebViewMessagePublisher.publish(message)
    }

    public sendChatMessageUpdate(message: ChatMessageUpdate) {
        this.appsToWebViewMessagePublisher.publish(message)
    }

    public sendAsyncEventProgress(message: AsyncEventProgressMessage) {
        this.appsToWebViewMessagePublisher.publish(message)
    }

    public sendPlaceholder(message: UpdatePlaceholderMessage) {
        this.appsToWebViewMessagePublisher.publish(message)
    }

    public sendAuthNeededExceptionMessage(message: AuthNeededException) {
        this.appsToWebViewMessagePublisher.publish(message)
    }

    public sendAuthenticationUpdate(message: AuthenticationUpdateMessage) {
        this.appsToWebViewMessagePublisher.publish(message)
    }

    public sendChatInputEnabled(message: ChatInputEnabledMessage) {
        this.appsToWebViewMessagePublisher.publish(message)
    }
}
