/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import { telemetry } from '../../../shared/telemetry/telemetry'
import { RefactorAssistantShowChatMessage } from '../../../shared/telemetry/telemetry.gen'
import { ToolkitError } from '../../../shared/errors'
import { SessionState, SessionStateAction, SessionStateConfig, State } from '../../types'
import * as nls from 'vscode-nls'
const localize = nls.loadMessageBundle()

export class StartOfConversation implements SessionState {
    constructor(private config: SessionStateConfig, public tabID: string) {}

    async interact(action: SessionStateAction): Promise<State> {
        const telemetryEvent: RefactorAssistantShowChatMessage = {
            sessionId: this.config.sessionId,
        }

        telemetry.refactorAssistant_showChatMessage.run(() => {
            telemetry.refactorAssistant_showChatMessage.record(telemetryEvent)
        })
        try {
            const createEngagementResponse = await this.config.proxyClient.createEngagement()
            this.config.engagementId = createEngagementResponse.engagementId
        } catch (error) {
            throw new ToolkitError('Failed to create engagement')
            return 'ConversationErrored'
        }

        const deriveIntentResult = await this.config.proxyClient.deriveUserIntent({
            engagementId: this.config.engagementId,
            userInput: action.msg,
        })

        // The user intent for input that is neither a code-related question
        // nor a request for an assessment:
        if (deriveIntentResult.userIntent === 'DEFAULT') {
            return 'Help'
        }

        action.messenger.sendAnswer({
            type: 'answer',
            tabID: this.tabID,
            message: localize(
                'AWS.amazonqRefactorAssistant.beforeStart',
                `No problem! Before I start, is there any other requirements you would want me to consider while generating your refactoring requirements?`
            ),
            followUp: {
                text: 'Try Examples:',
                options: [
                    {
                        pillText: localize(
                            'AWS.amazonqRefactorAssistant.coreFunctionalities',
                            'Describe the core functionalities of the monolithic application'
                        ),
                        prompt: localize(
                            'AWS.amazonqRefactorAssistant.coreFunctionalities',
                            'Describe the core functionalities of the monolithic application'
                        ),
                    },
                    {
                        pillText: localize('AWS.amazonqRefactorAssistant.noLetsStart', "No, let's start"),
                        prompt: localize('AWS.amazonqRefactorAssistant.noLetsStart', "No, let's start"),
                    },
                ],
            },
        })

        this.config.prompt = action.msg
        return 'GenerateInitialPlan'
    }
}
