/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import { SessionState, SessionStateAction, State } from '../../types'

export class ConversationNotStarted implements SessionState {
    constructor(public tabID: string) {}

    async interact(_action: SessionStateAction): Promise<State> {
        // TODO: Add custom errors
        throw new Error('Illegal State Transition')
    }
}
