/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ChatControllerEventEmitters } from '../../controllers/chat/controller'
import { MessageListener } from '../../../amazonq/messages/messageListener'
import { ExtensionMessage } from '../../../amazonq/webview/ui/commands'
import { openUrl } from '../../../shared/utilities/vsCodeUtils'
import { Uri } from 'vscode'

export interface UIMessageListenerProps {
    readonly chatControllerEventEmitters: ChatControllerEventEmitters
    readonly webViewMessageListener: MessageListener<any>
}

export class UIMessageListener {
    private refactorAssistantEventsEmitters: ChatControllerEventEmitters | undefined
    private webViewMessageListener: MessageListener<any>

    constructor(props: UIMessageListenerProps) {
        this.refactorAssistantEventsEmitters = props.chatControllerEventEmitters
        this.webViewMessageListener = props.webViewMessageListener

        // Now we are listening to events that get sent from amazonq/webview/actions/actionListener (e.g. the tab)
        this.webViewMessageListener.onMessage(msg => {
            this.handleMessage(msg)
        })
    }

    private handleMessage(msg: ExtensionMessage) {
        switch (msg.command) {
            case 'help':
                this.processHelpMessage(msg)
                break
            case 'chat-prompt':
                this.processChatMessage(msg)
                break
            case 'response-body-link-click':
                this.processResponseBodyLinkClick(msg)
                break
            case 'chat-item-voted':
                this.processChatItemVoted(msg)
                break
            case 'chat-item-feedback':
                this.processChatItemFeedback(msg)
                break
            case 'in-body-button-click':
                this.processInBodyButtonClick(msg)
                break
            case 'auth-follow-up-was-clicked':
                this.authClicked(msg)
                break
            case 'stop-response':
                this.stopResponse(msg)
                break
            case 'tab-was-removed':
                this.removeTab(msg)
                break
            case 'follow-up-was-clicked':
                this.followUpClicked(msg)
                break
        }
    }

    private processHelpMessage(msg: any) {
        this.refactorAssistantEventsEmitters?.processHelpMessage.fire({
            message: msg.chatMessage,
            tabID: msg.tabID,
        })
    }

    private processChatMessage(msg: any) {
        this.refactorAssistantEventsEmitters?.processHumanChatMessage.fire({
            message: msg.chatMessage,
            tabID: msg.tabID,
        })
    }

    private processResponseBodyLinkClick(msg: any) {
        if (msg.messageId === 'help-external-url') {
            void openUrl(Uri.parse(msg.link))
            return
        }
        this.refactorAssistantEventsEmitters?.processResponseBodyLinkClick.fire({
            command: msg.command,
            messageId: msg.messageId,
            tabID: msg.tabID,
            link: msg.link,
        })
    }

    private processChatItemVoted(msg: any) {
        // TODO: implement telemetry
        console.debug(msg)
    }

    private processChatItemFeedback(msg: any) {
        // TODO: implement telemetry
        console.debug(msg)
    }

    private processInBodyButtonClick(msg: any) {
        this.refactorAssistantEventsEmitters?.processInBodyButtonClick.fire({
            command: msg.command,
            messageId: msg.messageId,
            tabID: msg.tabID,
            action: msg.action,
        })
    }

    private authClicked(msg: any) {
        this.refactorAssistantEventsEmitters?.authClicked.fire({
            tabID: msg.tabID,
            authType: msg.authType,
        })
    }

    private stopResponse(msg: any) {
        this.refactorAssistantEventsEmitters?.stopResponse.fire({
            tabID: msg.tabID,
        })
    }

    private removeTab(msg: any) {
        this.refactorAssistantEventsEmitters?.removeTab.fire({
            tabID: msg.tabID,
        })
    }

    private followUpClicked(msg: any) {
        this.refactorAssistantEventsEmitters?.processHumanChatMessage.fire({
            message: msg.followUp.prompt,
            tabID: msg.tabID,
        })
    }
}
