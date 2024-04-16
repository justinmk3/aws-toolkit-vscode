/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import { SessionState, SessionStateAction, SessionStateConfig, State } from '../../types'
import { AbstractRefactoringState } from './AbstractRefactoringState'
import { TerminalStates } from '../../constants'
import { Messenger } from '../../controllers/chat/messenger/messenger'
import { randomUUID } from 'crypto'

export class PlanGenerationFollowup extends AbstractRefactoringState implements SessionState {
    private progressMessageId?: string

    constructor(private config: SessionStateConfig, public tabID: string) {
        super()
    }

    async explain(action: SessionStateAction): Promise<State> {
        // Ensure that the loading icon stays showing
        this.progressMessageId = randomUUID()
        action.messenger.sendInitalStream(this.tabID, this.progressMessageId, `Generating response...`)
        action.messenger.sendUpdatePlaceholder(this.tabID, 'Generating response ...')

        let pollResponse
        let workflowStatus = ''

        try {
            const startInteractionResponse = await this.config.proxyClient.startRefactoringInteraction({
                engagementId: this.config.engagementId,
                userInput: action.msg,
            })
            const interactionId = startInteractionResponse.interactionId
            workflowStatus = startInteractionResponse.status

            do {
                pollResponse = await this.config.proxyClient.pollRefactoringInteraction(
                    this.config.engagementId,
                    interactionId,
                    workflowStatus
                )

                if (pollResponse && !TerminalStates.includes(pollResponse.status)) {
                    workflowStatus = pollResponse.status

                    action.messenger.updateAnswer({
                        type: 'answer-stream',
                        tabID: this.tabID,
                        message: pollResponse.status,
                        messageId: this.progressMessageId,
                    })
                }
            } while (!TerminalStates.includes(pollResponse.status))

            action.messenger.sendAnswer({
                type: 'answer',
                tabID: this.tabID,
                message: pollResponse.response,
                canBeVoted: true,
            })

            action.messenger.sendAnswer({
                type: 'answer',
                tabID: this.tabID,
                message: `Would you like to ask another follow up?
    
You can ask me any follow up questions you may have or adjust any part by generating a revised analysis.`,
                followUp: {
                    text: 'Try Examples:',
                    options: [
                        {
                            pillText: 'Explain Output Validation Metrics',
                            prompt: 'explain analysis',
                        },
                        {
                            pillText: 'Explain recommended microservices',
                            prompt: 'explain analysis',
                        },
                        {
                            pillText: 'Generate a revised analysis',
                            prompt: 'revise analysis',
                        },
                    ],
                },
            })

            return 'PlanGenerationFollowup'
        } catch (error) {
            return 'ConversationErrored'
        }
    }

    async revise(action: SessionStateAction): Promise<State> {
        action.messenger.sendAnswer({
            type: 'answer',
            tabID: this.tabID,
            message: `No problem! Before I start, are there any aspects of the plan you would like me to focus on for the next revision?`,
            followUp: {
                text: 'Try Examples:',
                options: [
                    {
                        pillText: 'Optimize for costs',
                        prompt: 'Optimize for costs',
                    },
                    {
                        pillText: 'Break apart responsibilities into more distinct domains',
                        prompt: 'Break apart responsibilities into more distinct domains',
                    },
                ],
            },
        })

        return 'RevisePlan'
    }

    async newPlan(action: SessionStateAction): Promise<State> {
        action.messenger.sendAnswer({
            type: 'answer',
            tabID: this.tabID,
            message: `No problem! Before I start, is there any other requirements you would want me to consider while generating your refactoring requirements?`,
            followUp: {
                text: 'Try Examples:',
                options: [
                    {
                        pillText: 'Describe the core functionalities of the monolithic application',
                        prompt: 'Describe the core functionalities of the monolithic application',
                    },
                    {
                        pillText: "No, let's start",
                        prompt: "No, let's start",
                    },
                ],
            },
        })

        return 'GenerateInitialPlan'
    }

    async interact(action: SessionStateAction): Promise<State> {
        const deriveIntentResult = await this.config.proxyClient.deriveUserIntent({
            engagementId: this.config.engagementId,
            userInput: action.msg,
        })

        if (deriveIntentResult.userIntent === 'QUESTION_AND_ANSWER') {
            return this.explain(action)
        } else if (deriveIntentResult.userIntent === 'ASSESSMENT') {
            return this.revise(action)
        }

        action.messenger.sendAnswer({
            type: 'answer',
            tabID: this.tabID,
            message: `I'm sorry, I don't understand your response. 

You can ask me any follow up questions you may have or adjust any part by generating a revised analysis.`,
            followUp: {
                text: 'Try Examples:',
                options: [
                    {
                        pillText: 'Explain Output Validation Metrics',
                        prompt: 'explain analysis',
                    },
                    {
                        pillText: 'Explain recommended microservices',
                        prompt: 'explain analysis',
                    },
                    {
                        pillText: 'Generate a revised analysis',
                        prompt: 'revise analysis',
                    },
                ],
            },
        })

        return 'PlanGenerationFollowup'
    }

    async cancel(messenger: Messenger) {
        try {
            this.cancelled = true

            await this.config.proxyClient.stopRefactoringAssessment({
                engagementId: this.config.engagementId,
                assessmentId: this.config.assessmentId,
            })

            if (this.progressMessageId) {
                messenger.updateAnswer({
                    type: 'answer-stream',
                    tabID: this.tabID,
                    message: 'Cancelling plan generation',
                    messageId: this.progressMessageId,
                })
            }
        } catch (error) {
            // swallow this exception, as if our cancellation request fails it's better to just not cancel
            console.error(error)
        }
    }
}
