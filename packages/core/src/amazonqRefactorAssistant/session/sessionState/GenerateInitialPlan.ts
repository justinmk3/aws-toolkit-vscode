/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import { SessionState, SessionStateAction, SessionStateConfig, State } from '../../types'
import { v4 as uuidv4 } from 'uuid'
import { Messenger } from '../../controllers/chat/messenger/messenger'
import { AbstractRefactoringState } from './AbstractRefactoringState'
import { getWorkspaceFolders } from '../../util/files'

export class GenerateInitialPlan extends AbstractRefactoringState implements SessionState {
    private progressMessageId?: string

    constructor(private config: SessionStateConfig, public tabID: string) {
        super()
    }

    async interact(action: SessionStateAction): Promise<State> {
        const workspaceFolders = getWorkspaceFolders()
        if (workspaceFolders === undefined || workspaceFolders.length === 0) {
            this.config.error =
                "I'm sorry, I can't create a plan for an empty workspace. Please open a workspace you would like to create a refactor assessment for."
            return 'ConversationErrored'
        }

        action.messenger.sendAnswer({
            type: 'answer',
            tabID: this.tabID,
            message: `Ok, let me create a plan. This may take a few minutes`,
        })

        // Ensure that the loading icon stays showing
        const progressMessageId = uuidv4()
        action.messenger.sendInitalStream(this.tabID, progressMessageId, `Uploading workspace...`)

        try {
            const createEngagementResponse = await this.config.proxyClient.createEngagement()
            this.config.engagementId = createEngagementResponse.engagementId
        } catch (error) {
            return 'ConversationErrored'
        }

        // upload code
        try {
            await this.config.proxyClient.uploadWorkspace(this.config.engagementId)
        } catch (error) {
            return 'ConversationErrored'
        }

        try {
            const startRefactoringResponse = await this.config.proxyClient.startRefactoringAssessment({
                engagementId: this.config.engagementId,
                userInput: `${this.config.prompt} ${action.msg}`,
            })
            this.config.assessmentId = startRefactoringResponse.assessmentId
        } catch (error) {
            return 'ConversationErrored'
        }

        return this.handlePlanExecution(action, this.tabID, this.config, progressMessageId)
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
                })
            }
        } catch (error) {
            // swallow this exception, as if our cancellation request fails it's better to just not cancel
            console.error(error)
        }
    }
}
