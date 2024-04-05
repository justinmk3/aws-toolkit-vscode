/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import { SessionState, SessionStateAction, SessionStateConfig, State } from '../../types'

export class StartOfConversation implements SessionState {
    constructor(private config: SessionStateConfig, public tabID: string) {}

    async interact(action: SessionStateAction): Promise<State> {
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

        this.config.prompt = action.msg
        return 'GenerateInitialPlan'
    }
}
