/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import { SessionState, SessionStateAction, SessionStateConfig, State } from '../../types'
import { Messenger } from '../../controllers/chat/messenger/messenger'
import { AbstractRefactoringState } from './AbstractRefactoringState'
import { telemetry } from '../../../shared/telemetry/telemetry'
import { ToolkitError } from '../../../shared/errors'
import { randomUUID } from 'crypto'

export class RevisePlan extends AbstractRefactoringState implements SessionState {
    private progressMessageId?: string

    constructor(private config: SessionStateConfig, public tabID: string) {
        super()
    }

    async interact(action: SessionStateAction): Promise<State> {
        action.messenger.sendAnswer({
            type: 'answer',
            tabID: this.tabID,
            message: `Ok, let me revise the plan. This may take a few minutes`,
        })

        // Ensure that the loading icon stays showing
        const progressMessageId = randomUUID()
        action.messenger.sendInitalStream(this.tabID, progressMessageId, `Starting plan revision...`)

        try {
            await this.config.proxyClient.updateRefactoringAssessment({
                engagementId: this.config.engagementId,
                assessmentId: this.config.assessmentId,
                userInput: action.msg,
            })
        } catch (error) {
            throw new ToolkitError('Revised plan generation has failed', { code: 'ServerError' })
        }
        let nextState: State
        await telemetry.refactorAssistant_updateRecommendation.run(async telemetrySpan => {
            telemetrySpan.record({
                sessionId: this.config.sessionId,
                reportId: this.config.assessmentId,
            })
            nextState = await this.handlePlanExecution(action, this.tabID, this.config, progressMessageId)

            return nextState
        })
        // @ts-ignore
        return nextState
    }

    async cancel(messenger: Messenger) {
        try {
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
                    finalUpdate: true,
                })
            }
        } catch (error) {
            // swallow this exception, as if our cancellation request fails it's better to just not cancel
            console.error(error)
        }
    }
}
