/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { Messenger } from './controllers/chat/messenger/messenger'
import { RefactorAssistantClient } from './client/refactorAssistant'
import { VirtualFileSystem } from '../shared/virtualFilesystem'

export interface SessionStateInteraction {
    nextState: SessionState | Omit<SessionState, 'uploadId'> | undefined
}

export interface SessionState {
    readonly tabID: string
    interact(action: SessionStateAction): Promise<SessionStateInteraction>
    cancel?(messenger: Messenger): Promise<void>
}

export interface SessionStateConfig {
    proxyClient: RefactorAssistantClient
    engagementId: string
    assessmentId: string
    recommendationId: string
}

export interface SessionStateAction {
    msg: string
    messenger: Messenger
    tabID: string
    fs: VirtualFileSystem
}