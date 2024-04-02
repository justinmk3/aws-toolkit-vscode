/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { Messenger } from '../controllers/chat/messenger/messenger'
import { RefactorAssistantClient } from '../client/refactorAssistant'
import { StartOfConversation } from './sessionState'
import { SessionState } from '../types'
import { SessionConfig } from './sessionConfigFactory'

export class Session {
    private state?: SessionState | Omit<SessionState, 'uploadId'>

    // Used to keep track of whether or not the current session is currently authenticating/needs authenticating
    public isAuthenticating: boolean

    constructor(
        public readonly config: SessionConfig,
        private messenger: Messenger,
        public readonly tabID: string,
        proxyClient: RefactorAssistantClient = new RefactorAssistantClient()
    ) {
        this.isAuthenticating = false
        this.state = new StartOfConversation(
            {
                engagementId: '',
                recommendationId: '',
                assessmentId: '',
                proxyClient,
            },
            this.tabID
        )
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

        const resp = await this.state.interact({
            msg,
            messenger: this.messenger,
            tabID: this.tabID,
            fs: this.config.fs,
        })

        this.state = resp.nextState
    }
}
