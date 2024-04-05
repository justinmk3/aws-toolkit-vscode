/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import sinon from 'sinon'
import * as vscode from 'vscode'
import assert from 'assert'
import * as fileUtils from '../../../amazonqRefactorAssistant/util/files'
import { PlanGenerationFollowup } from '../../../amazonqRefactorAssistant/session/sessionState/PlanGenerationFollowup'
import { GenerateInitialPlan } from '../../../amazonqRefactorAssistant/session/sessionState/GenerateInitialPlan'
import { StartOfConversation } from '../../../amazonqRefactorAssistant/session/sessionState/StartOfConversation'
import { RevisePlan } from '../../../amazonqRefactorAssistant/session/sessionState/RevisePlan'
import { SessionStateConfig, SessionStateAction } from '../../../amazonqRefactorAssistant/types'
import { Messenger } from '../../../amazonqRefactorAssistant/controllers/chat/messenger/messenger'
import { AppToWebViewMessageDispatcher } from '../../../amazonqRefactorAssistant/views/connector/connector'
import { MessagePublisher } from '../../../amazonq/messages/messagePublisher'
import { RefactorAssistantClient } from '../../../amazonqRefactorAssistant/client/refactorAssistant'
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
let mockUploadWorkspace: sinon.SinonStub
let mockdownloadPlan: sinon.SinonStub

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
        uploadWorkspace: () => mockUploadWorkspace(),
        downloadPlan: () => mockdownloadPlan(),
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

            assert.strictEqual(response, 'GenerateInitialPlan')
            sinon.assert.calledOnce(mockMessenger)
        })
    })

    describe('GenerateInitialPlan', () => {
        const firstPrompt = 'please suggest a microservice'
        const secondPrompt = 'please focus on the cart functionality'
        let stubStartRefactoringAssessment: sinon.SinonStub
        let stubSendInitialStream: sinon.SinonStub
        let stubSendUpdatePlaceholder: sinon.SinonStub
        let stubUpdateAnswer: sinon.SinonStub
        let stubFileSystem: sinon.SinonStub
        let stubSendAnswer: sinon.SinonStub
        let stubUploadWorkspace: sinon.SinonStub
        let stubDownloadPlan: sinon.SinonStub
        let stubCreateEngagement: sinon.SinonStub
        let mockGetWorkspaceFolders: sinon.SinonStub

        beforeEach(() => {
            stubStartRefactoringAssessment = sinon
                .stub(testConfig.proxyClient, 'startRefactoringAssessment')
                .resolves({ assessmentId, status: 'IN_PROGRESS' })
            stubSendInitialStream = sinon.stub(Messenger.prototype, 'sendInitalStream')
            stubSendUpdatePlaceholder = sinon.stub(Messenger.prototype, 'sendUpdatePlaceholder')
            stubUpdateAnswer = sinon.stub(Messenger.prototype, 'updateAnswer')
            stubFileSystem = sinon.stub(VirtualFileSystem.prototype, 'registerProvider')
            stubSendAnswer = sinon.stub(Messenger.prototype, 'sendAnswer')
            stubUploadWorkspace = sinon.stub(testConfig.proxyClient, 'uploadWorkspace')
            stubDownloadPlan = sinon.stub(testConfig.proxyClient, 'downloadPlan').resolves('')
            stubCreateEngagement = sinon.stub(testConfig.proxyClient, 'createEngagement').resolves({
                engagementId,
            })
            mockGetWorkspaceFolders = sinon.stub(fileUtils, 'getWorkspaceFolders').resolves(['/index.ts'])
        })

        it('kicks off recommendation and polls for completion', async () => {
            const pollForStatusStub = sinon.stub(testConfig.proxyClient, 'pollRefactoringAssessmentStatus').resolves({
                assessmentStatus: 'The plan has succeeded',
                status: 'COMPLETED',
                engagementId,
                assessmentId,
            })

            await new GenerateInitialPlan(testConfig, tabId).interact(mockSessionStateAction(secondPrompt))

            sinon.assert.calledOnce(mockGetWorkspaceFolders)
            sinon.assert.calledOnce(stubCreateEngagement)
            sinon.assert.calledOnce(stubUploadWorkspace)
            sinon.assert.calledOnceWithExactly(stubStartRefactoringAssessment, {
                engagementId,
                userInput: firstPrompt + ' ' + secondPrompt,
            })
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
            sinon.assert.calledOnce(stubDownloadPlan)
            sinon.assert.calledOnce(stubFileSystem)
            sinon.assert.callCount(stubSendAnswer, 4)
        })

        it('shows vscode notification upon success', async () => {
            const testWindow = getTestWindow()

            sinon.stub(testConfig.proxyClient, 'pollRefactoringAssessmentStatus').resolves({
                assessmentStatus: 'The plan has succeeded',
                status: 'COMPLETED',
                assessmentId,
                engagementId,
            })

            // If the user chooses the download button

            testWindow.onDidShowMessage(message => {
                assert.strictEqual(message.message, analysisFinishedNotification.body)
                message.selectItem(analysisFinishedNotification.download)
            })
            // Choosing the download button brings up a dialog
            testWindow.onDidShowDialog(message => {
                assert.ok(message.title)
            })

            await new GenerateInitialPlan(testConfig, tabId).interact(mockSessionStateAction(secondPrompt))

            assert(testWindow.shownMessages.some(message => message.message === analysisFinishedNotification.body))
        })

        it('detects failed status and sends error message to user', async () => {
            const pollForStatusStub = sinon.stub(testConfig.proxyClient, 'pollRefactoringAssessmentStatus').resolves({
                assessmentStatus: 'The plan has failed',
                status: 'FAILED',
                assessmentId,
                engagementId,
            })

            await new GenerateInitialPlan(testConfig, tabId).interact(mockSessionStateAction(secondPrompt))

            sinon.assert.calledOnce(stubCreateEngagement)
            sinon.assert.calledOnce(stubUploadWorkspace)
            sinon.assert.calledOnceWithExactly(stubStartRefactoringAssessment, {
                engagementId,
                userInput: firstPrompt + ' ' + secondPrompt,
            })
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
            sinon.assert.notCalled(stubDownloadPlan)
            sinon.assert.notCalled(stubFileSystem)
            sinon.assert.calledTwice(stubSendAnswer)
        })

        it('detects cancelled status and notifies user', async () => {
            const pollForStatusStub = sinon.stub(testConfig.proxyClient, 'pollRefactoringAssessmentStatus').resolves({
                assessmentStatus: 'The plan was cancelled',
                status: 'CANCELLED',
                assessmentId,
                engagementId,
            })

            await new GenerateInitialPlan(testConfig, tabId).interact(mockSessionStateAction(secondPrompt))

            sinon.assert.calledOnce(stubCreateEngagement)
            sinon.assert.calledOnce(stubUploadWorkspace)
            sinon.assert.calledOnceWithExactly(stubStartRefactoringAssessment, {
                engagementId,
                userInput: firstPrompt + ' ' + secondPrompt,
            })
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
            sinon.assert.notCalled(stubDownloadPlan)
            sinon.assert.notCalled(stubFileSystem)
            sinon.assert.calledTwice(stubSendAnswer)
        })
    })

    describe('RevisePlan', () => {
        const secondPrompt = 'please focus on the cart functionality'
        let stubUpdateRefactoringAssessment: sinon.SinonStub
        let stubSendInitialStream: sinon.SinonStub
        let stubSendUpdatePlaceholder: sinon.SinonStub
        let stubUpdateAnswer: sinon.SinonStub
        let stubFileSystem: sinon.SinonStub
        let stubSendAnswer: sinon.SinonStub
        let stubDownloadPlan: sinon.SinonStub

        beforeEach(() => {
            stubFileSystem = sinon.stub(VirtualFileSystem.prototype, 'registerProvider')
            stubDownloadPlan = sinon.stub(testConfig.proxyClient, 'downloadPlan').resolves('revised plan')
            stubUpdateRefactoringAssessment = sinon
                .stub(testConfig.proxyClient, 'updateRefactoringAssessment')
                .resolves({ status: 'IN_PROGRESS', engagementId: '', assessmentId: '' })
            stubSendInitialStream = sinon.stub(Messenger.prototype, 'sendInitalStream')
            stubSendUpdatePlaceholder = sinon.stub(Messenger.prototype, 'sendUpdatePlaceholder')
            stubUpdateAnswer = sinon.stub(Messenger.prototype, 'updateAnswer')
            stubSendAnswer = sinon.stub(Messenger.prototype, 'sendAnswer')
        })

        it('kicks off recommendation and polls for completion', async () => {
            const pollForStatusStub = sinon.stub(testConfig.proxyClient, 'pollRefactoringAssessmentStatus').resolves({
                assessmentStatus: 'The plan has succeeded',
                status: 'COMPLETED',
                engagementId,
                assessmentId,
            })

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
            sinon.assert.calledOnce(stubDownloadPlan)
            sinon.assert.calledOnce(stubFileSystem)
            sinon.assert.callCount(stubSendAnswer, 4)
        })

        it('shows vscode notification upon success', async () => {
            const testWindow = getTestWindow()

            sinon.stub(testConfig.proxyClient, 'pollRefactoringAssessmentStatus').resolves({
                assessmentStatus: 'The plan has succeeded',
                status: 'COMPLETED',
                engagementId,
                assessmentId,
            })

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
            const pollForStatusStub = sinon.stub(testConfig.proxyClient, 'pollRefactoringAssessmentStatus').resolves({
                assessmentStatus: 'The plan has failed',
                status: 'FAILED',
                engagementId,
                assessmentId,
            })

            await new RevisePlan(testConfig, tabId).interact(mockSessionStateAction(secondPrompt))

            sinon.assert.calledOnceWithExactly(stubUpdateRefactoringAssessment, {
                engagementId,
                assessmentId,
                userInput: secondPrompt,
            })
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
            sinon.assert.calledTwice(stubSendAnswer)
        })

        it('detects cancelled status and notifies user', async () => {
            const pollForStatusStub = sinon.stub(testConfig.proxyClient, 'pollRefactoringAssessmentStatus').resolves({
                assessmentStatus: 'The plan was cancelled',
                status: 'CANCELLED',
                engagementId,
                assessmentId,
            })

            await new RevisePlan(testConfig, tabId).interact(mockSessionStateAction(secondPrompt))

            sinon.assert.calledOnceWithExactly(stubUpdateRefactoringAssessment, {
                engagementId,
                assessmentId,
                userInput: secondPrompt,
            })
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
            sinon.assert.calledTwice(stubSendAnswer)
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
                .resolves({ userIntent: 'QUESTION_AND_ANSWER' })
            stubStartRefactoringInteraction = sinon
                .stub(testConfig.proxyClient, 'startRefactoringInteraction')
                .resolves({ status: 'IN_PROGRESS', interactionId: '123', engagementId: '' })
            stubPollRefactoringInteraction = sinon
                .stub(testConfig.proxyClient, 'pollRefactoringInteraction')
                .resolves({ status: 'COMPLETED', response: 'test response', engagementId: '', interactionId: '' })

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

            assert.strictEqual(result, 'PlanGenerationFollowup')
        })

        it('revises plan when prompted', async () => {
            stubDeriveUserIntent = sinon
                .stub(testConfig.proxyClient, 'deriveUserIntent')
                .resolves({ userIntent: 'ASSESSMENT' })

            const result = await new PlanGenerationFollowup(testConfig, tabId).interact(mockSessionStateAction())

            sinon.assert.calledOnce(stubDeriveUserIntent)
            sinon.assert.calledOnce(stubSendAnswer)

            assert.strictEqual(result, 'RevisePlan')
        })
    })
})
