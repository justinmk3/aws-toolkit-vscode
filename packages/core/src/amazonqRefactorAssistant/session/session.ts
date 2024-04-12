/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import { Messenger } from '../controllers/chat/messenger/messenger'
import { RefactorAssistantClient } from '../client/refactorAssistant'
import { SessionState, State, SessionStateConfig } from '../types'
import { SessionConfig } from './sessionConfigFactory'

import { ConversationErrored } from './sessionState/ConversationErrored'
import { ConversationNotStarted } from './sessionState/ConversationNotStarted'
import { GenerateInitialPlan } from './sessionState/GenerateInitialPlan'
import { PlanGenerationFollowup } from './sessionState/PlanGenerationFollowup'
import { RevisePlan } from './sessionState/RevisePlan'
import { StartOfConversation } from './sessionState/StartOfConversation'
import { randomUUID } from 'crypto'

export class Session {
    private state?: SessionState
    private stateConfig: SessionStateConfig
    public sessionId: string
    public sessionStartTime: number
    // Used to keep track of whether or not the current session is currently authenticating/needs authenticating
    public isAuthenticating: boolean

    constructor(
        public readonly config: SessionConfig,
        private messenger: Messenger,
        public readonly tabID: string,
        proxyClient: RefactorAssistantClient = new RefactorAssistantClient()
    ) {
        this.isAuthenticating = false
        // The sessionId is used for telemetry to track a user's entire sequence of activity
        // within a Refactor Assist tab
        this.sessionId = randomUUID()
        // We'll track the time to see how long the user keeps the tab open
        this.sessionStartTime = performance.now()
        this.stateConfig = {
            engagementId: '',
            recommendationId: '',
            assessmentId: '',
            proxyClient,
            sessionId: this.sessionId,
            // This will be set by the individual Session instances
            // every time they start a new plan generation
            reportGenerationStartTime: 0,
        }

        this.state = new StartOfConversation(this.stateConfig, this.tabID)
    }

    nextState(next: State): SessionState {
        switch (next) {
            case 'ConversationErrored':
                return new ConversationErrored(this.stateConfig, this.tabID)
            case 'ConversationNotStarted':
                return new ConversationNotStarted(this.tabID)
            case 'GenerateInitialPlan':
                return new GenerateInitialPlan(this.stateConfig, this.tabID)
            case 'PlanGenerationFollowup':
                return new PlanGenerationFollowup(this.stateConfig, this.tabID)
            case 'RevisePlan':
                return new RevisePlan(this.stateConfig, this.tabID)
            case 'StartOfConversation':
                return new StartOfConversation(this.stateConfig, this.tabID)
            default:
                return new ConversationErrored(this.stateConfig, this.tabID)
        }
    }

    async cancel() {
        if (this.state?.cancel) {
            await this.state.cancel(this.messenger)
        }
    }

    async send(msg: string) {
        void this.nextInteraction(msg)
    }

    private async nextInteraction(msg: string) {
        if (!this.state) {
            throw new Error('Cannot interact with unitialized state')
        }

        this.state = this.nextState(
            await this.state.interact({
                msg,
                messenger: this.messenger,
                tabID: this.tabID,
                fs: this.config.fs,
            })
        )
    }
}
