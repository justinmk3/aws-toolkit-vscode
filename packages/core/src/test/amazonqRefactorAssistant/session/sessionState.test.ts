/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import sinon from 'sinon'
import * as vscode from 'vscode'
import assert from 'assert'
import {
    GenerateInitialPlan,
    StartOfConversation,
    RevisePlan,
    PlanGenerationFollowup,
} from '../../../amazonqRefactorAssistant/session/sessionState'
import { SessionStateConfig, SessionStateAction } from '../../../amazonqRefactorAssistant/types'
import { Messenger } from '../../../amazonqRefactorAssistant/controllers/chat/messenger/messenger'
import { AppToWebViewMessageDispatcher } from '../../../amazonqRefactorAssistant/views/connector/connector'
import { MessagePublisher } from '../../../amazonq/messages/messagePublisher'
import { RefactorAssistantClient } from '../../../amazonqRefactorAssistant/client/refactorAssistant'
import * as fileUtils from '../../../amazonqRefactorAssistant/util/files'
import { VirtualFileSystem } from '../../../shared/virtualFilesystem'
import { getTestWindow } from '../../shared/vscode/window'
import { analysisFinishedNotification } from '../../../amazonqRefactorAssistant/constants'

const mockSessionStateAction = (
    msg?: string,
    mockFileSystem?: VirtualFileSystem,
    mockMessenger?: Messenger
): SessionStateAction => {
    return {
        msg: msg ?? 'test-msg',
        messenger:
            mockMessenger ??
            new Messenger(new AppToWebViewMessageDispatcher(new MessagePublisher<any>(new vscode.EventEmitter<any>()))),
        tabID: 'test-id',
        fs: mockFileSystem ?? new VirtualFileSystem(),
    }
}

let mockUploadCode: sinon.SinonStub
let mockcreateEngagement: sinon.SinonStub
let mockdeleteEngagement: sinon.SinonStub
let mockcreateUploadUrl: sinon.SinonStub
let mockcreateDownloadUrl: sinon.SinonStub
let mockderiveUserIntent: sinon.SinonStub
let mockstartRefactoringAssessment: sinon.SinonStub
let mockgetRefactoringAssessmentStatus: sinon.SinonStub
let mockUpdateRefactoringAssessment: sinon.SinonStub
let mockStopRefactoringAssessment: sinon.SinonStub
let mockStartRefactoringInteraction: sinon.SinonStub
let mockGetRefactoringInteraction: sinon.SinonStub
let mockpollRefactoringAssessmentStatus: sinon.SinonStub
let mockPollRefactoringInteraction: sinon.SinonStub
let mockdownloadFile: sinon.SinonStub

const mockSessionStateConfig = ({
    engagementId,
    assessmentId,
    recommendationId,
}: {
    engagementId: string
    assessmentId: string
    recommendationId: string
}): SessionStateConfig => ({
    engagementId,
    assessmentId,
    recommendationId,
    proxyClient: {
        uploadCode: () => mockUploadCode(),
        createEngagement: () => mockcreateEngagement(),
        deleteEngagement: () => mockdeleteEngagement(),
        createUploadUrl: () => mockcreateUploadUrl(),
        createDownloadUrl: () => mockcreateDownloadUrl(),
        deriveUserIntent: () => mockderiveUserIntent(),
        startRefactoringAssessment: () => mockstartRefactoringAssessment(),
        getRefactoringAssessmentStatus: () => mockgetRefactoringAssessmentStatus(),
        updateRefactoringAssessment: () => mockUpdateRefactoringAssessment(),
        stopRefactoringAssessment: () => mockStopRefactoringAssessment(),
        startRefactoringInteraction: () => mockStartRefactoringInteraction(),
        getRefactoringInteraction: () => mockGetRefactoringInteraction(),
        pollRefactoringAssessmentStatus: () => mockpollRefactoringAssessmentStatus(),
        pollRefactoringInteraction: () => mockPollRefactoringInteraction(),
        downloadFile: () => mockdownloadFile(),
    } as unknown as RefactorAssistantClient,
})

describe('Refactor Assistant sessionState', () => {
    const engagementId = 'conversation-id'
    const assessmentId = 'assessment-id'
    const recommendationId = 'recommendation-id'
    const tabId = 'tab-id'
    const testConfig = mockSessionStateConfig({
        engagementId,
        assessmentId,
        recommendationId,
    })

    afterEach(() => {
        sinon.restore()
        getTestWindow().dispose()
    })

    describe('StartOfConversation', () => {
        it('sends response to user and returns GetMoreDetails state', async () => {
            const firstPrompt = 'please suggest a microservice'
            const testAction = mockSessionStateAction(firstPrompt)

            const mockMessenger = sinon.stub(Messenger.prototype, 'sendAnswer')

            const sessionState = new StartOfConversation(testConfig, tabId)
            const response = await sessionState.interact(testAction)

            assert(response.nextState instanceof GenerateInitialPlan)
            sinon.assert.calledOnce(mockMessenger)
        })
    })

    describe('GenerateInitialPlan', () => {
        const testRepo = '/test-repo'
        const testBuffer = { zipFileBuffer: Buffer.from('test-files') }
        const firstPrompt = 'please suggest a microservice'
        const secondPrompt = 'please focus on the cart functionality'
        let stubGetWorkspaceRoot: sinon.SinonStub
        let stubPrepareRepoData: sinon.SinonStub
        let stubCreateDownloadUrl: sinon.SinonStub
        let stubUploadCode: sinon.SinonStub
        let stubStartRefactoringAssessment: sinon.SinonStub
        let stubSendInitialStream: sinon.SinonStub
        let stubSendUpdatePlaceholder: sinon.SinonStub
        let stubUpdateAnswer: sinon.SinonStub
        let stubFileSystem: sinon.SinonStub
        let stubSendAnswer: sinon.SinonStub

        beforeEach(() => {
            stubGetWorkspaceRoot = sinon.stub(fileUtils, 'getWorkspaceRootDir').returns(testRepo)
            stubPrepareRepoData = sinon.stub(fileUtils, 'prepareRepoData').resolves(testBuffer)
            stubCreateDownloadUrl = sinon
                .stub(testConfig.proxyClient, 'createDownloadUrl')
                .resolves({ s3url: '/test-url' })
            stubUploadCode = sinon.stub(testConfig.proxyClient, 'uploadCode').resolves({ conversationId: engagementId })
            stubStartRefactoringAssessment = sinon
                .stub(testConfig.proxyClient, 'startRefactoringAssessment')
                .resolves({ assessmentId, workflowStatus: 'in progress' })
            stubSendInitialStream = sinon.stub(Messenger.prototype, 'sendInitalStream')
            stubSendUpdatePlaceholder = sinon.stub(Messenger.prototype, 'sendUpdatePlaceholder')
            stubUpdateAnswer = sinon.stub(Messenger.prototype, 'updateAnswer')
            stubFileSystem = sinon.stub(VirtualFileSystem.prototype, 'registerProvider')
            stubSendAnswer = sinon.stub(Messenger.prototype, 'sendAnswer')
        })

        it('kicks off recommendation and polls for completion', async () => {
            const pollForStatusStub = sinon
                .stub(testConfig.proxyClient, 'pollRefactoringAssessmentStatus')
                .resolves({ assessmentStatus: 'The plan has succeeded', workflowStatus: 'succeeded' })

            await new GenerateInitialPlan(testConfig, firstPrompt, tabId).interact(mockSessionStateAction(secondPrompt))

            sinon.assert.calledOnce(stubGetWorkspaceRoot)
            sinon.assert.calledOnceWithExactly(stubPrepareRepoData, testRepo)
            sinon.assert.calledOnceWithExactly(stubUploadCode, testBuffer.zipFileBuffer)
            sinon.assert.calledOnceWithExactly(
                stubStartRefactoringAssessment,
                engagementId,
                firstPrompt + secondPrompt,
                'markdown'
            )
            sinon.assert.calledOnce(pollForStatusStub)
            sinon.assert.calledOnce(stubSendInitialStream)
            sinon.assert.calledTwice(stubSendUpdatePlaceholder)
            assert.strictEqual(
                stubSendUpdatePlaceholder.calledWith('tab-id', 'Generating implementation plan ...'),
                true
            )
            // Called again, because the process is cancelled
            assert.strictEqual(stubSendUpdatePlaceholder.calledWith('tab-id', ''), true)
            sinon.assert.calledOnce(stubUpdateAnswer)
            sinon.assert.calledOnce(stubFileSystem)
            sinon.assert.callCount(stubSendAnswer, 4)
            sinon.assert.calledOnce(stubCreateDownloadUrl)
        })

        it('shows vscode notification upon success', async () => {
            const testWindow = getTestWindow()

            sinon
                .stub(testConfig.proxyClient, 'pollRefactoringAssessmentStatus')
                .resolves({ assessmentStatus: 'The plan has succeeded', workflowStatus: 'succeeded' })

            // If the user chooses the download button

            testWindow.onDidShowMessage(message => {
                assert.strictEqual(message.message, analysisFinishedNotification.body)
                message.selectItem(analysisFinishedNotification.download)
            })
            // Choosing the download button brings up a dialog
            testWindow.onDidShowDialog(message => {
                assert.ok(message.title)
            })

            await new GenerateInitialPlan(testConfig, firstPrompt, tabId).interact(mockSessionStateAction(secondPrompt))

            assert(testWindow.shownMessages.some(message => message.message === analysisFinishedNotification.body))
        })

        it('detects failed status and sends error message to user', async () => {
            const pollForStatusStub = sinon
                .stub(testConfig.proxyClient, 'pollRefactoringAssessmentStatus')
                .resolves({ assessmentStatus: 'The plan has failed', workflowStatus: 'failed' })

            await new GenerateInitialPlan(testConfig, firstPrompt, tabId).interact(mockSessionStateAction(secondPrompt))

            sinon.assert.calledOnceWithExactly(
                stubStartRefactoringAssessment,
                engagementId,
                firstPrompt + secondPrompt,
                'markdown'
            )
            sinon.assert.calledOnce(pollForStatusStub)
            sinon.assert.calledOnce(stubSendInitialStream)
            sinon.assert.calledTwice(stubSendUpdatePlaceholder)
            assert.strictEqual(
                stubSendUpdatePlaceholder.calledWith('tab-id', 'Generating implementation plan ...'),
                true
            )
            // Called again, because the process is cancelled
            assert.strictEqual(stubSendUpdatePlaceholder.calledWith('tab-id', ''), true)
            sinon.assert.calledOnce(stubUpdateAnswer)
            sinon.assert.notCalled(stubFileSystem)
            sinon.assert.calledTwice(stubSendAnswer)
            sinon.assert.notCalled(stubCreateDownloadUrl)
        })

        it('detects cancelled status and notifies user', async () => {
            const pollForStatusStub = sinon
                .stub(testConfig.proxyClient, 'pollRefactoringAssessmentStatus')
                .resolves({ assessmentStatus: 'The plan was cancelled', workflowStatus: 'cancelled' })

            await new GenerateInitialPlan(testConfig, firstPrompt, tabId).interact(mockSessionStateAction(secondPrompt))

            sinon.assert.calledOnceWithExactly(
                stubStartRefactoringAssessment,
                engagementId,
                firstPrompt + secondPrompt,
                'markdown'
            )
            sinon.assert.calledOnce(pollForStatusStub)
            sinon.assert.calledOnce(stubSendInitialStream)
            sinon.assert.calledTwice(stubSendUpdatePlaceholder)
            assert.strictEqual(
                stubSendUpdatePlaceholder.calledWith('tab-id', 'Generating implementation plan ...'),
                true
            )
            // Called again, because the process is cancelled
            assert.strictEqual(stubSendUpdatePlaceholder.calledWith('tab-id', ''), true)
            sinon.assert.calledOnce(stubUpdateAnswer)
            sinon.assert.notCalled(stubFileSystem)
            sinon.assert.calledTwice(stubSendAnswer)
            sinon.assert.notCalled(stubCreateDownloadUrl)
        })
    })

    describe('RevisePlan', () => {
        const secondPrompt = 'please focus on the cart functionality'
        let stubCreateDownloadUrl: sinon.SinonStub
        let stubUpdateRefactoringAssessment: sinon.SinonStub
        let stubSendInitialStream: sinon.SinonStub
        let stubSendUpdatePlaceholder: sinon.SinonStub
        let stubUpdateAnswer: sinon.SinonStub
        let stubFileSystem: sinon.SinonStub
        let stubSendAnswer: sinon.SinonStub

        beforeEach(() => {
            stubCreateDownloadUrl = sinon
                .stub(testConfig.proxyClient, 'createDownloadUrl')
                .resolves({ s3url: '/test-url' })
            stubUpdateRefactoringAssessment = sinon
                .stub(testConfig.proxyClient, 'updateRefactoringAssessment')
                .resolves({ workflowStatus: 'in progress' })
            stubSendInitialStream = sinon.stub(Messenger.prototype, 'sendInitalStream')
            stubSendUpdatePlaceholder = sinon.stub(Messenger.prototype, 'sendUpdatePlaceholder')
            stubUpdateAnswer = sinon.stub(Messenger.prototype, 'updateAnswer')
            stubFileSystem = sinon.stub(VirtualFileSystem.prototype, 'registerProvider')
            stubSendAnswer = sinon.stub(Messenger.prototype, 'sendAnswer')
        })

        it('kicks off recommendation and polls for completion', async () => {
            const pollForStatusStub = sinon
                .stub(testConfig.proxyClient, 'pollRefactoringAssessmentStatus')
                .resolves({ assessmentStatus: 'The plan has succeeded', workflowStatus: 'succeeded' })

            await new RevisePlan(testConfig, tabId).interact(mockSessionStateAction(secondPrompt))

            sinon.assert.calledOnce(pollForStatusStub)
            sinon.assert.calledOnce(stubSendInitialStream)
            sinon.assert.calledTwice(stubSendUpdatePlaceholder)
            assert.strictEqual(
                stubSendUpdatePlaceholder.calledWith('tab-id', 'Generating implementation plan ...'),
                true
            )
            // Called again, because the process is cancelled
            assert.strictEqual(stubSendUpdatePlaceholder.calledWith('tab-id', ''), true)
            sinon.assert.calledOnce(stubUpdateAnswer)
            sinon.assert.calledOnce(stubFileSystem)
            sinon.assert.callCount(stubSendAnswer, 4)
            sinon.assert.calledOnce(stubCreateDownloadUrl)
        })

        it('shows vscode notification upon success', async () => {
            const testWindow = getTestWindow()

            sinon
                .stub(testConfig.proxyClient, 'pollRefactoringAssessmentStatus')
                .resolves({ assessmentStatus: 'The plan has succeeded', workflowStatus: 'succeeded' })

            // If the user chooses the download button

            testWindow.onDidShowMessage(message => {
                assert.strictEqual(message.message, analysisFinishedNotification.body)
                message.selectItem(analysisFinishedNotification.download)
            })
            // Choosing the download button brings up a dialog
            testWindow.onDidShowDialog(message => {
                assert.ok(message.title)
            })

            await new RevisePlan(testConfig, tabId).interact(mockSessionStateAction(secondPrompt))

            assert(testWindow.shownMessages.some(message => message.message === analysisFinishedNotification.body))
        })

        it('detects failed status and sends error message to user', async () => {
            const pollForStatusStub = sinon
                .stub(testConfig.proxyClient, 'pollRefactoringAssessmentStatus')
                .resolves({ assessmentStatus: 'The plan has failed', workflowStatus: 'failed' })

            await new RevisePlan(testConfig, tabId).interact(mockSessionStateAction(secondPrompt))

            sinon.assert.calledOnceWithExactly(
                stubUpdateRefactoringAssessment,
                engagementId,
                assessmentId,
                secondPrompt
            )
            sinon.assert.calledOnce(pollForStatusStub)
            sinon.assert.calledOnce(stubSendInitialStream)
            sinon.assert.calledTwice(stubSendUpdatePlaceholder)
            assert.strictEqual(
                stubSendUpdatePlaceholder.calledWith('tab-id', 'Generating implementation plan ...'),
                true
            )
            // Called again, because the process is cancelled
            assert.strictEqual(stubSendUpdatePlaceholder.calledWith('tab-id', ''), true)
            sinon.assert.calledOnce(stubUpdateAnswer)
            sinon.assert.notCalled(stubFileSystem)
            sinon.assert.calledTwice(stubSendAnswer)
            sinon.assert.notCalled(stubCreateDownloadUrl)
        })

        it('detects cancelled status and notifies user', async () => {
            const pollForStatusStub = sinon
                .stub(testConfig.proxyClient, 'pollRefactoringAssessmentStatus')
                .resolves({ assessmentStatus: 'The plan was cancelled', workflowStatus: 'cancelled' })

            await new RevisePlan(testConfig, tabId).interact(mockSessionStateAction(secondPrompt))

            sinon.assert.calledOnceWithExactly(
                stubUpdateRefactoringAssessment,
                engagementId,
                assessmentId,
                secondPrompt
            )
            sinon.assert.calledOnce(pollForStatusStub)
            sinon.assert.calledOnce(stubSendInitialStream)
            sinon.assert.calledTwice(stubSendUpdatePlaceholder)
            assert.strictEqual(
                stubSendUpdatePlaceholder.calledWith('tab-id', 'Generating implementation plan ...'),
                true
            )
            // Called again, because the process is cancelled
            assert.strictEqual(stubSendUpdatePlaceholder.calledWith('tab-id', ''), true)
            sinon.assert.calledOnce(stubUpdateAnswer)
            sinon.assert.notCalled(stubFileSystem)
            sinon.assert.calledTwice(stubSendAnswer)
            sinon.assert.notCalled(stubCreateDownloadUrl)
        })
    })

    describe('PlanGenerationFollowup', () => {
        let stubStartRefactoringInteraction: sinon.SinonStub
        let stubPollRefactoringInteraction: sinon.SinonStub
        let stubDeriveUserIntent: sinon.SinonStub
        let stubSendInitialStream: sinon.SinonStub
        let stubSendUpdatePlaceholder: sinon.SinonStub
        let stubUpdateAnswer: sinon.SinonStub
        let stubSendAnswer: sinon.SinonStub

        beforeEach(() => {
            stubSendInitialStream = sinon.stub(Messenger.prototype, 'sendInitalStream')
            stubSendUpdatePlaceholder = sinon.stub(Messenger.prototype, 'sendUpdatePlaceholder')
            stubUpdateAnswer = sinon.stub(Messenger.prototype, 'updateAnswer')
            stubSendAnswer = sinon.stub(Messenger.prototype, 'sendAnswer')
        })

        it('explains code when prompted', async () => {
            stubDeriveUserIntent = sinon
                .stub(testConfig.proxyClient, 'deriveUserIntent')
                .resolves({ intent: 'explain analysis' })
            stubStartRefactoringInteraction = sinon
                .stub(testConfig.proxyClient, 'startRefactoringInteraction')
                .resolves({ workflowStatus: '', interactionId: '123' })
            stubPollRefactoringInteraction = sinon
                .stub(testConfig.proxyClient, 'pollRefactoringInteraction')
                .resolves({ workflowStatus: 'succeeded', response: 'test response' })

            const result = await new PlanGenerationFollowup(testConfig, tabId).interact(mockSessionStateAction())

            sinon.assert.calledOnce(stubDeriveUserIntent)
            sinon.assert.calledOnce(stubStartRefactoringInteraction)
            sinon.assert.calledOnce(stubPollRefactoringInteraction)
            sinon.assert.calledOnce(stubSendInitialStream)
            sinon.assert.calledOnce(stubSendUpdatePlaceholder)
            sinon.assert.calledOnce(stubSendUpdatePlaceholder)
            assert.strictEqual(stubSendUpdatePlaceholder.calledWith('tab-id', 'Generating response ...'), true)
            // Because the response status was "succeeded", we won't call stubUpdateAnswer,
            // because "succeeded" is a terminal state and we don't update answer for a terminal state
            sinon.assert.notCalled(stubUpdateAnswer)
            sinon.assert.calledTwice(stubSendAnswer)

            assert(result.nextState instanceof PlanGenerationFollowup)
        })

        it('creates a new analysis when prompted', async () => {
            stubDeriveUserIntent = sinon
                .stub(testConfig.proxyClient, 'deriveUserIntent')
                .resolves({ intent: 'new analysis' })

            const result = await new PlanGenerationFollowup(testConfig, tabId).interact(mockSessionStateAction())

            sinon.assert.calledOnce(stubDeriveUserIntent)
            sinon.assert.calledOnce(stubSendAnswer)

            assert(result.nextState instanceof GenerateInitialPlan)
        })

        it('revises plan when prompted', async () => {
            stubDeriveUserIntent = sinon
                .stub(testConfig.proxyClient, 'deriveUserIntent')
                .resolves({ intent: 'revise analysis' })

            const result = await new PlanGenerationFollowup(testConfig, tabId).interact(mockSessionStateAction())

            sinon.assert.calledOnce(stubDeriveUserIntent)
            sinon.assert.calledOnce(stubSendAnswer)

            assert(result.nextState instanceof RevisePlan)
        })
    })
})
