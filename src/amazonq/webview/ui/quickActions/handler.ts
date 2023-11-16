/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ChatItemType, ChatPrompt, MynahUI, NotificationType } from '@aws/mynah-ui-chat'
import { TabDataGenerator } from '../tabs/generator'
import { Connector } from '../connector'
import { TabsStorage } from '../storages/tabsStorage'
import { uiComponentsTexts } from '../texts/constants'

export interface QuickActionsHandlerProps {
    mynahUI: MynahUI
    connector: Connector
    tabsStorage: TabsStorage
    isWeaverbirdEnabled: boolean
    isGumbyEnabled: boolean
}

export class QuickActionHandler {
    private mynahUI: MynahUI
    private connector: Connector
    private tabsStorage: TabsStorage
    private tabDataGenerator: TabDataGenerator
    private isWeaverbirdEnabled: boolean

    constructor(props: QuickActionsHandlerProps) {
        this.mynahUI = props.mynahUI
        this.connector = props.connector
        this.tabsStorage = props.tabsStorage
        this.tabDataGenerator = new TabDataGenerator({
            isWeaverbirdEnabled: props.isWeaverbirdEnabled,
            isGumbyEnabled: props.isGumbyEnabled,
        })
        this.isWeaverbirdEnabled = props.isWeaverbirdEnabled
    }

    public handle(chatPrompt: ChatPrompt, tabID: string) {
        this.tabsStorage.resetTabTimer(tabID)
        switch (chatPrompt.command) {
            case '/dev':
                this.handleWeaverbirdCommand(chatPrompt, tabID, 'Q - Dev', '/dev')
                break
            case '/tests':
                this.handleWeaverbirdCommand(chatPrompt, tabID, 'Q - Tests', '/tests')
                break
            case '/fix':
                this.handleWeaverbirdCommand(chatPrompt, tabID, 'Q - Fix', '/fix')
                break
            case '/clear':
                this.handleClearCommand(tabID)
                break
            case '/transform':
                this.handleGumbyCommand(tabID)
                break
        }
    }

    private handleGumbyCommand(tabID: string) {
        this.connector.transform(tabID)
    }

    private handleClearCommand(tabID: string) {
        this.mynahUI.updateStore(tabID, {
            chatItems: [],
        })
        this.connector.clearChat(tabID)
    }

    private handleWeaverbirdCommand(chatPrompt: ChatPrompt, tabID: string, taskName: string, commandName: string) {
        if (!this.isWeaverbirdEnabled) {
            return
        }

        let affectedTabId: string | undefined = tabID
        const realPromptText = chatPrompt.escapedPrompt?.trim() ?? ''
        if (this.tabsStorage.getTab(affectedTabId)?.type !== 'unknown') {
            affectedTabId = this.mynahUI.updateStore('', {})
        }
        if (affectedTabId === undefined) {
            this.mynahUI.notify({
                content: uiComponentsTexts.noMoreTabsTooltip,
                type: NotificationType.WARNING,
            })
            return
        } else {
            this.tabsStorage.updateTabTypeFromUnknown(affectedTabId, 'wb')
            this.connector.onKnownTabOpen(affectedTabId)
            this.connector.onUpdateTabType(affectedTabId)

            this.mynahUI.updateStore(affectedTabId, { chatItems: [] })
            this.mynahUI.updateStore(
                affectedTabId,
                this.tabDataGenerator.getTabData('wb', realPromptText === '', taskName, commandName)
            )

            if (realPromptText !== '') {
                this.mynahUI.addChatItem(affectedTabId, {
                    type: ChatItemType.PROMPT,
                    body: realPromptText,
                    ...(chatPrompt.attachment !== undefined
                        ? {
                              relatedContent: {
                                  content: [chatPrompt.attachment],
                              },
                          }
                        : {}),
                })

                this.mynahUI.addChatItem(affectedTabId, {
                    type: ChatItemType.ANSWER_STREAM,
                    body: '',
                })

                this.mynahUI.updateStore(affectedTabId, {
                    loadingChat: true,
                    promptInputDisabledState: true,
                })

                this.connector.requestGenerativeAIAnswer(affectedTabId, {
                    chatMessage: realPromptText,
                })
            }
        }
    }
}