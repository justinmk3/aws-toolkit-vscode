/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import { SessionState, SessionStateAction, SessionStateConfig, State } from '../../types'

export class ConversationErrored implements SessionState {
    constructor(private config: SessionStateConfig, public tabID: string) {}

    async interact(action: SessionStateAction): Promise<State> {
        action.messenger.sendAnswer({
            type: 'answer',
            tabID: this.tabID,
            message: this.config.error || 'Sorry, something went wrong. Please try again.',
        })

        this.config.error = undefined
        return 'ConversationNotStarted'
    }
}
