/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import sinon from 'sinon'
import { waitUntil } from '../../../../shared/utilities/timeoutUtils'
import { ControllerSetup, createController, createSession } from '../../utils'
import { Session } from '../../../../amazonqRefactorAssistant/session/session'
import * as authUtil from '../../../../codewhisperer/util/authUtil'
import { Messenger } from '../../../../amazonqRefactorAssistant/controllers/chat/messenger/messenger'
import { AuthController } from '../../../../amazonq/auth/controller'

describe('Controller', () => {
    const tabID = '123'
    const assessmentId = '456'

    let session: Session
    let controllerSetup: ControllerSetup

    before(() => {
        sinon.stub(performance, 'now').returns(0)
    })

    beforeEach(async () => {
        controllerSetup = await createController()
        session = await createSession({ messenger: controllerSetup.messenger, assessmentId, tabID })
    })

    afterEach(() => {
        sinon.restore()
    })

    describe('process human chat message', () => {
        async function userMessageSent(message: string) {
            const getSessionStub = sinon.stub(controllerSetup.sessionStorage, 'getSession').resolves(session)

            controllerSetup.emitters.processHumanChatMessage.fire({
                tabID,
                message,
            })

            // Wait until the controller has time to process the event
            await waitUntil(() => {
                return Promise.resolve(getSessionStub.callCount > 0)
            }, {})
        }

        it('sends message to session when authenticated', async () => {
            const message = 'please suggest a microservice'
            const chatAuthStateStub = sinon
                .stub(authUtil, 'getChatAuthState')
                .resolves({ codewhispererCore: 'connected', codewhispererChat: 'connected', amazonQ: 'connected' })
            const sessionSendStub = sinon.stub(Session.prototype, 'send')

            await userMessageSent(message)

            sinon.assert.calledOnce(chatAuthStateStub)
            sinon.assert.calledOnceWithExactly(sessionSendStub, message)
        })

        it('sends auth needed message when not authenticated', async () => {
            const message = 'please suggest a microservice'
            const chatAuthStateStub = sinon
                .stub(authUtil, 'getChatAuthState')
                .resolves({ codewhispererCore: 'connected', codewhispererChat: 'connected', amazonQ: 'disconnected' })
            const sessionSendStub = sinon.stub(Session.prototype, 'send')
            const messengerSendAuthNeededStub = sinon.stub(Messenger.prototype, 'sendAuthNeededExceptionMessage')

            await userMessageSent(message)

            sinon.assert.calledOnce(chatAuthStateStub)
            sinon.assert.notCalled(sessionSendStub)
            sinon.assert.calledOnce(messengerSendAuthNeededStub)
        })
    })

    describe('authClicked', () => {
        async function authClicked() {
            const getSessionStub = sinon.stub(controllerSetup.sessionStorage, 'getSession').resolves(session)

            controllerSetup.emitters.authClicked.fire({
                tabID,
                authType: 'test-auth-type',
            })

            // Wait until the controller has time to process the event
            await waitUntil(() => {
                return Promise.resolve(getSessionStub.callCount > 0)
            }, {})
        }

        it('sends authenticated message and enables chat', async () => {
            const messengerSendStub = sinon.stub(Messenger.prototype, 'sendAnswer')
            const messengerEnableChatStub = sinon.stub(Messenger.prototype, 'sendChatInputEnabled')
            const authControllerStub = sinon.stub(AuthController.prototype, 'handleAuth')

            await authClicked()

            sinon.assert.calledOnce(messengerSendStub)
            sinon.assert.calledOnce(messengerEnableChatStub)
            sinon.assert.calledOnce(authControllerStub)
        })
    })
})
