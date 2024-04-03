/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from 'vscode'
import * as sinon from 'sinon'
import { MessagePublisher } from '../../amazonq/messages/messagePublisher'
import { Messenger } from '../../amazonqRefactorAssistant/controllers/chat/messenger/messenger'
import { AppToWebViewMessageDispatcher } from '../../amazonqRefactorAssistant/views/connector/connector'
import {
    ChatControllerEventEmitters,
    RefactorAssistantController,
} from '../../amazonqRefactorAssistant/controllers/chat/controller'
import { ChatSessionStorage } from '../../amazonqRefactorAssistant/storage/chatSession'
import { createTestWorkspaceFolder } from '../testUtil'
import { createSessionConfig } from '../../amazonqRefactorAssistant/session/sessionConfigFactory'
import { Session } from '../../amazonqRefactorAssistant/session/session'
import { SessionState } from '../../amazonqRefactorAssistant/types'
import { RefactorAssistantClient } from '../../amazonqRefactorAssistant/client/refactorAssistant'

export function createMessenger(): Messenger {
    return new Messenger(
        new AppToWebViewMessageDispatcher(new MessagePublisher(sinon.createStubInstance(vscode.EventEmitter)))
    )
}

export function createMockChatEmitters(): ChatControllerEventEmitters {
    return {
        processHumanChatMessage: new vscode.EventEmitter<any>(),
        authClicked: new vscode.EventEmitter<any>(),
        processResponseBodyLinkClick: new vscode.EventEmitter<any>(),
        processInBodyButtonClick: new vscode.EventEmitter<any>(),
        stopResponse: new vscode.EventEmitter<any>(),
        removeTab: new vscode.EventEmitter<any>(),
    }
}

export interface ControllerSetup {
    emitters: ChatControllerEventEmitters
    workspaceFolder: vscode.WorkspaceFolder
    messenger: Messenger
    sessionStorage: ChatSessionStorage
}

export async function createSession({
    messenger,
    assessmentId = '0',
    tabID = '0',
}: {
    messenger: Messenger
    sessionState?: Omit<SessionState, 'uploadId'>
    assessmentId?: string
    tabID?: string
}) {
    const sessionConfig = await createSessionConfig()

    const client = sinon.createStubInstance(
        RefactorAssistantClient
    ) as sinon.SinonStubbedInstance<RefactorAssistantClient> & RefactorAssistantClient
    client.startRefactoringAssessment.resolves({ assessmentId, status: 'IN_PROGRESS' })
    const session = new Session(sessionConfig, messenger, tabID, client)

    return session
}

export async function createController(): Promise<ControllerSetup> {
    const messenger = createMessenger()

    // Create a new workspace root
    const testWorkspaceFolder = await createTestWorkspaceFolder()
    sinon.stub(vscode.workspace, 'workspaceFolders').value([testWorkspaceFolder])

    const sessionStorage = new ChatSessionStorage(messenger)

    const mockChatControllerEventEmitters = createMockChatEmitters()

    new RefactorAssistantController(
        mockChatControllerEventEmitters,
        sinon.createStubInstance(vscode.EventEmitter).event,
        messenger,
        sessionStorage
    )

    return {
        emitters: mockChatControllerEventEmitters,
        workspaceFolder: testWorkspaceFolder,
        messenger,
        sessionStorage,
    }
}
