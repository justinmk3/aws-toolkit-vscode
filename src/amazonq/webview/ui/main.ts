/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import { Connector } from './connector'
import { ChatItem, ChatItemType, MynahUI, MynahUIDataModel, NotificationType } from '@aws/mynah-ui-chat'
import './styles/dark.scss'
import { ChatPrompt } from '@aws/mynah-ui-chat/dist/static'
import { TabsStorage } from './storages/tabsStorage'
import { WelcomeFollowupType } from './apps/amazonqCommonsConnector'
import { TabDataGenerator } from './tabs/generator'
import { feedbackOptions } from './feedback/constants'
import { uiComponentsTexts } from './texts/constants'
import { FollowUpInteractionHandler } from './followUps/handler'
import { QuickActionHandler } from './quickActions/handler'
import { TextMessageHandler } from './messages/handler'
import { MessageController } from './messages/controller'

export const createMynahUI = (
    weaverbirdInitEnabled: boolean,
    gumbyInitEnabled: boolean,
    initialData?: MynahUIDataModel
) => {
    // eslint-disable-next-line prefer-const
    let mynahUI: MynahUI
    // eslint-disable-next-line prefer-const
    let connector: Connector
    const ideApi = acquireVsCodeApi()
    const tabsStorage = new TabsStorage({
        onTabTimeout: tabID => {
            mynahUI.addChatItem(tabID, {
                type: ChatItemType.ANSWER,
                body: 'Your session is ended for this tab, please open a new one.',
            })
            mynahUI.updateStore(tabID, {
                promptInputDisabledState: true,
                promptInputPlaceholder: 'Session ended.',
            })
        },
    })
    // Adding the first tab as CWC tab
    tabsStorage.addTab({
        id: 'tab-1',
        status: 'free',
        type: 'unknown',
        isSelected: true,
    })

    // used to keep track of whether or not weaverbird is enabled and has an active idC
    let isWeaverbirdEnabled = weaverbirdInitEnabled

    const isGumbyEnabled = gumbyInitEnabled

    const tabDataGenerator = new TabDataGenerator({
        isWeaverbirdEnabled,
        isGumbyEnabled,
    })

    // eslint-disable-next-line prefer-const
    let followUpsInteractionHandler: FollowUpInteractionHandler
    // eslint-disable-next-line prefer-const
    let quickActionHandler: QuickActionHandler
    // eslint-disable-next-line prefer-const
    let textMessageHandler: TextMessageHandler
    // eslint-disable-next-line prefer-const
    let messageControler: MessageController

    // eslint-disable-next-line prefer-const
    connector = new Connector({
        tabsStorage,
        onUpdateAuthentication: (weaverbirdEnabled: boolean): void => {
            const selectedTab = tabsStorage.getSelectedTab()

            isWeaverbirdEnabled = weaverbirdEnabled

            if (!selectedTab) {
                return
            }

            /**
             * If someone switches authentication when they're on the main page then reset the chat items and the quick actions
             * and that triggers a change in weaverbird availability
             */
            if (selectedTab?.type === 'unknown') {
                mynahUI.updateStore(selectedTab.id, {
                    chatItems: [],
                })
                mynahUI.updateStore(selectedTab.id, tabDataGenerator.getTabData('unknown', true))
            }
        },
        onCWCOnboardingPageInteractionMessage: (message: ChatItem): string | undefined => {
            return messageControler.sendMessageToTab(message, 'cwc')
        },
        onCWCContextCommandMessage: (message: ChatItem, command?: string): string | undefined => {
            const selectedTab = tabsStorage.getSelectedTab()

            if (selectedTab !== undefined && command === 'aws.amazonq.sendToPrompt') {
                mynahUI.addToUserPrompt(selectedTab.id, message.body as string)
                return selectedTab.id
            }

            return messageControler.sendMessageToTab(message, 'cwc')
        },
        onWelcomeFollowUpClicked: (tabID: string, welcomeFollowUpType: WelcomeFollowupType) => {
            followUpsInteractionHandler.onWelcomeFollowUpClicked(tabID, welcomeFollowUpType)
        },
        onChatInputEnabled: (tabID: string, enabled: boolean) => {
            mynahUI.updateStore(tabID, {
                promptInputDisabledState: tabsStorage.isTabDead(tabID) || !enabled,
            })
        },
        onAsyncEventProgress: (tabID: string, inProgress: boolean, message: string | undefined) => {
            if (inProgress) {
                mynahUI.updateStore(tabID, {
                    loadingChat: true,
                    promptInputDisabledState: true,
                })
                if (message) {
                    mynahUI.addChatItem(tabID, {
                        type: ChatItemType.ANSWER,
                        body: message,
                    })
                }
                mynahUI.addChatItem(tabID, {
                    type: ChatItemType.ANSWER_STREAM,
                    body: '',
                })
                tabsStorage.updateTabStatus(tabID, 'busy')
                return
            }

            mynahUI.updateStore(tabID, {
                loadingChat: false,
                promptInputDisabledState: tabsStorage.isTabDead(tabID),
            })
            tabsStorage.updateTabStatus(tabID, 'free')
        },
        sendMessageToExtension: message => {
            ideApi.postMessage(message)
        },
        onChatAnswerReceived: (tabID: string, item: ChatItem) => {
            if (item.type === ChatItemType.ANSWER_PART || item.type === ChatItemType.CODE_RESULT) {
                mynahUI.updateLastChatAnswer(tabID, {
                    ...(item.messageId !== undefined ? { messageId: item.messageId } : {}),
                    ...(item.canBeVoted !== undefined ? { canBeVoted: item.canBeVoted } : {}),
                    ...(item.codeReference !== undefined ? { codeReference: item.codeReference } : {}),
                    ...(item.body !== undefined ? { body: item.body } : {}),
                    ...(item.relatedContent !== undefined ? { relatedContent: item.relatedContent } : {}),
                    ...(item.type === ChatItemType.CODE_RESULT ? { type: ChatItemType.CODE_RESULT } : {}),
                })
                return
            }

            if (item.body !== undefined || item.relatedContent !== undefined || item.followUp !== undefined) {
                mynahUI.addChatItem(tabID, item)
            }

            if (
                item.type === ChatItemType.PROMPT ||
                item.type === ChatItemType.SYSTEM_PROMPT ||
                item.type === ChatItemType.AI_PROMPT
            ) {
                mynahUI.updateStore(tabID, {
                    loadingChat: true,
                    promptInputDisabledState: true,
                })

                tabsStorage.updateTabStatus(tabID, 'busy')
                return
            }

            if (item.type === ChatItemType.ANSWER) {
                mynahUI.updateStore(tabID, {
                    loadingChat: false,
                    promptInputDisabledState: tabsStorage.isTabDead(tabID),
                })
                tabsStorage.updateTabStatus(tabID, 'free')
            }
        },
        onMessageReceived: (tabID: string, messageData: MynahUIDataModel) => {
            mynahUI.updateStore(tabID, messageData)
        },
        onWarning: (tabID: string, message: string, title: string) => {
            mynahUI.notify({
                title: title,
                content: message,
                type: NotificationType.WARNING,
            })
            mynahUI.updateStore(tabID, {
                loadingChat: false,
                promptInputDisabledState: tabsStorage.isTabDead(tabID),
            })
            tabsStorage.updateTabStatus(tabID, 'free')
        },
        onError: (tabID: string, message: string, title: string) => {
            const answer: ChatItem = {
                type: ChatItemType.ANSWER,
                body: `**${title}** 
${message}`,
            }

            if (tabID !== '') {
                mynahUI.updateStore(tabID, {
                    loadingChat: false,
                    promptInputDisabledState: tabsStorage.isTabDead(tabID),
                })
                tabsStorage.updateTabStatus(tabID, 'free')

                mynahUI.addChatItem(tabID, answer)
            } else {
                const newTabId = mynahUI.updateStore('', {
                    tabTitle: 'Error',
                    quickActionCommands: [],
                    promptInputPlaceholder: '',
                    chatItems: [answer],
                })
                if (newTabId === undefined) {
                    mynahUI.notify({
                        content: uiComponentsTexts.noMoreTabsTooltip,
                        type: NotificationType.WARNING,
                    })
                    return
                } else {
                    // TODO remove this since it will be added with the onTabAdd and onTabAdd is now sync,
                    // It means that it cannot trigger after the updateStore function returns.
                    tabsStorage.addTab({
                        id: newTabId,
                        status: 'busy',
                        type: 'unknown',
                        isSelected: true,
                    })
                }
            }
            return
        },
        onUpdatePlaceholder(tabID: string, newPlaceholder: string) {
            mynahUI.updateStore(tabID, {
                promptInputPlaceholder: newPlaceholder,
            })
        },
    })

    mynahUI = new MynahUI({
        onReady: connector.uiReady,
        onTabAdd: connector.onTabAdd,
        onTabRemove: connector.onTabRemove,
        onTabChange: connector.onTabChange,
        onChatPrompt: (tabID: string, prompt: ChatPrompt) => {
            if ((prompt.prompt ?? '') === '' && (prompt.command ?? '') === '') {
                return
            }

            if (prompt.command !== undefined && prompt.command.trim() !== '') {
                quickActionHandler.handle(prompt, tabID)
                return
            }

            textMessageHandler.handle(prompt, tabID)
        },
        onVote: connector.onChatItemVoted,
        onSendFeedback: (tabId, feedbackPayload) => {
            connector.sendFeedback(tabId, feedbackPayload)
            mynahUI.notify({
                type: NotificationType.INFO,
                title: 'Your feedback is sent',
                content: 'Thanks for your feedback.',
            })
        },
        onCodeInsertToCursorPosition: connector.onCodeInsertToCursorPosition,
        onCopyCodeToClipboard: (tabId, messageId, code, type, referenceTrackerInfo) => {
            connector.onCopyCodeToClipboard(tabId, messageId, code, type, referenceTrackerInfo)
            mynahUI.notify({
                type: NotificationType.SUCCESS,
                content: 'Selected code is copied to clipboard',
            })
        },
        onChatItemEngagement: connector.triggerSuggestionEngagement,
        onSourceLinkClick: (tabId, messageId, link, mouseEvent) => {
            mouseEvent?.preventDefault()
            mouseEvent?.stopPropagation()
            mouseEvent?.stopImmediatePropagation()
            connector.onSourceLinkClick(tabId, messageId, link)
        },
        onLinkClick: (tabId, messageId, link, mouseEvent) => {
            mouseEvent?.preventDefault()
            mouseEvent?.stopPropagation()
            mouseEvent?.stopImmediatePropagation()
            connector.onResponseBodyLinkClick(tabId, messageId, link)
        },
        onResetStore: () => {},
        onFollowUpClicked: (tabID, messageId, followUp) => {
            followUpsInteractionHandler.onFollowUpClicked(tabID, messageId, followUp)
        },
        onOpenDiff: connector.onOpenDiff,
        tabs: {
            'tab-1': {
                isSelected: true,
                store: tabDataGenerator.getTabData('unknown', true),
            },
        },
        defaults: {
            store: tabDataGenerator.getTabData('unknown', true),
        },
        config: {
            maxTabs: 10,
            feedbackOptions: feedbackOptions,
            texts: uiComponentsTexts,
        },
    })

    followUpsInteractionHandler = new FollowUpInteractionHandler({
        mynahUI,
        connector,
        tabsStorage,
        isWeaverbirdEnabled,
        isGumbyEnabled,
    })
    quickActionHandler = new QuickActionHandler({
        mynahUI,
        connector,
        tabsStorage,
        isWeaverbirdEnabled,
        isGumbyEnabled,
    })
    textMessageHandler = new TextMessageHandler({
        mynahUI,
        connector,
        tabsStorage,
    })
    messageControler = new MessageController({
        mynahUI,
        connector,
        tabsStorage,
        isWeaverbirdEnabled,
        isGumbyEnabled,
    })
}