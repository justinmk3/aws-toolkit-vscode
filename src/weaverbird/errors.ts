/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ToolkitError } from '../shared/errors'

export class ConversationIdNotFoundError extends ToolkitError {
    constructor() {
        super('Conversation id must exist before starting code generation', { code: 'ConversationIdNotFound' })
    }
}

export class TabIdNotFoundError extends ToolkitError {
    constructor(query: string) {
        super(`Tab id was not found from ${query}`, { code: 'TabIdNotFound' })
    }
}

export class PanelLoadError extends ToolkitError {
    constructor() {
        super(`Weaverbird UI panel failed to load`, { code: 'PanelLoadFailed' })
    }
}

export class WorkspaceFolderNotFoundError extends ToolkitError {
    constructor() {
        super(`Workspace folder was not found. Open a workspace to continue using Weaverbird`, {
            code: 'WorkspaceFolderNotFound',
        })
    }
}

export class SessionNotFoundError extends ToolkitError {
    constructor() {
        super(`Session was not found`, { code: 'SessionNotFound' })
    }
}

export class UserMessageNotFoundError extends ToolkitError {
    constructor() {
        super(`Message was not found`, { code: 'MessageNotFound' })
    }
}

const denyListedErrors: string[] = ['Deserialization error']

export function createUserFacingErrorMessage(message: string) {
    if (denyListedErrors.some(err => message.includes(err))) {
        return 'Weaverbird API request failed'
    }
    return message
}