/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { SessionState, SessionStateAction, SessionStateConfig, State } from '../../types'
import * as nls from 'vscode-nls'
const localize = nls.loadMessageBundle()

export class HelpUser implements SessionState {
    constructor(private config: SessionStateConfig, public tabID: string) {}

    async interact(action: SessionStateAction): Promise<State> {
        action.messenger.sendAnswer({
            type: 'answer',
            tabID: this.tabID,
            message: localize(
                'AWS.amazonqRefactorAssistant.help',
                "Try asking questions related to refactoring a monolithic codebase to microservices, generating starter code to microservices or help with deploying a microservice starter code. To learn what Refactor Assistant can do for you, see <a href='https://quip-amazon.com/aZsUAgb7aeAB/Amazon-Q-Refactor-Assistant-Design-Document-for-AWS-toolkit-extension-in-VS-Code-MVP'>this link</a>"
            ),
            messageId: 'help-external-url',

            followUp: {
                text: 'Try Examples:',
                options: [
                    {
                        pillText: 'Run analysis',
                        prompt: 'Run analysis',
                    },
                ],
            },
        })

        this.config.prompt = ''
        return 'StartOfConversation'
    }
}
