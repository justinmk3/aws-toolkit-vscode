/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import request from '../../common/request'
import { getWorkspaceRootDir, prepareRepoData } from '../util/files'

type UserIntent = 'ASSESSMENT' | 'QUESTION_AND_ANSWER' | 'DEFAULT'
export type WorkflowStatus = 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

type CreateEngagementResult = {
    engagementId: string
}

type CreateDownloadUrlResult = {
    signedDownloadUrl: string
    requestHeaders: Record<string, string>
}

type CreateDownloadUrlInput = {
    engagementId: string
    contentType: 'ASSESSMENT'
    outputType: 'MD' | 'PDF'
    assessmentId: string
}

type CreateUploadUrlResult = {
    signedUploadUrl: string
    requestHeaders: Record<string, string>
}

type CreateUploadUrlInput = {
    engagementId: string
    contentChecksumSha256: string
}

type DeriveUserIntentResult = {
    userIntent: UserIntent
}

type DeriveUserIntentInput = {
    engagementId: string
    userInput: string
}

export type StartRefactoringAssessmentResult = {
    assessmentId: string
    status: WorkflowStatus
}

type StartRefactoringAssessmentInput = {
    engagementId: string
    userInput: string
}

export type GetRefactoringAssessmentStatusResult = {
    engagementId: string
    assessmentId: string
    status: WorkflowStatus
    assessmentStatus: string
}

type GetRefactoringAssessmentStatusInput = {
    engagementId: string
    assessmentId: string
}

type UpdateRefactoringAssessmentResult = {
    engagementId: string
    assessmentId: string
    status: WorkflowStatus
}

type UpdateRefactoringAssessmentInput = {
    engagementId: string
    assessmentId: string
    userInput: string
}

type StopRefactoringAssessmentResult = {
    engagementId: string
    assessmentId: string
    status: WorkflowStatus
}

type StopRefactoringAssessmentInput = {
    engagementId: string
    assessmentId: string
}

type StartRefactoringInteractionResult = {
    engagementId: string
    interactionId: string
    status: WorkflowStatus
}

type StartRefactoringInteractionInput = {
    engagementId: string
    userInput: string
}

type GetRefactoringInteractionResult = {
    engagementId: string
    interactionId: string
    status: WorkflowStatus
    response: string
}

type GetRefactoringInteractionInput = {
    engagementId: string
    interactionId: string
}

export class RefactorAssistantClient {
    private accountId: string

    constructor() {
        // TODO: set this to the users account
        this.accountId = Math.random().toString().slice(2, 14)
    }

    private getClientMetadata() {
        return {
            accountId: this.accountId,
        }
    }

    private async callApi(apiName: string, params: Record<string, any>): Promise<any> {
        try {
            const body = JSON.stringify({
                clientMetadata: this.getClientMetadata(),
                ...params,
            })

            const response = await request.fetch('POST', `http://localhost:3030/${apiName}`, {
                body,
                headers: {
                    'Content-Type': 'application/json',
                },
            }).response

            const json = await response.json()

            console.log(apiName, params, json)

            return json
        } catch (error) {
            console.error(error)
            throw error
        }
    }

    public async createEngagement(): Promise<CreateEngagementResult> {
        const result = await this.callApi('createEngagement', {})
        return {
            engagementId: result.engagementId,
        }
    }

    public async createDownloadUrl(params: CreateDownloadUrlInput): Promise<CreateDownloadUrlResult> {
        const result = await this.callApi('createDownloadUrl', params)
        return {
            signedDownloadUrl: result.signedDownloadUrl,
            requestHeaders: result.requestHeaders,
        }
    }

    public async createUploadUrl(params: CreateUploadUrlInput): Promise<CreateUploadUrlResult> {
        const result = await this.callApi('createUploadUrl', params)
        return {
            signedUploadUrl: result.signedUploadUrl,
            requestHeaders: result.requestHeaders,
        }
    }

    public async deriveUserIntent(params: DeriveUserIntentInput): Promise<DeriveUserIntentResult> {
        const result = await this.callApi('deriveUserIntent', params)
        return {
            userIntent: result.userIntent,
        }
    }

    public async startRefactoringAssessment(
        params: StartRefactoringAssessmentInput
    ): Promise<StartRefactoringAssessmentResult> {
        const result = await this.callApi('startRefactoringAssessment', params)
        return {
            assessmentId: result.assessmentId,
            status: result.status,
        }
    }

    public async updateRefactoringAssessment(
        params: UpdateRefactoringAssessmentInput
    ): Promise<UpdateRefactoringAssessmentResult> {
        const result = await this.callApi('updateRefactoringAssessment', params)
        return {
            engagementId: result.engagementId,
            assessmentId: result.assessmentId,
            status: result.status,
        }
    }

    public async stopRefactoringAssessment(
        params: StopRefactoringAssessmentInput
    ): Promise<StopRefactoringAssessmentResult> {
        const result = await this.callApi('stopRefactoringAssessment', params)
        return {
            engagementId: result.engagementId,
            assessmentId: result.assessmentId,
            status: result.status,
        }
    }

    public async startRefactoringInteraction(
        params: StartRefactoringInteractionInput
    ): Promise<StartRefactoringInteractionResult> {
        const result = await this.callApi('startRefactoringInteraction', params)
        return {
            engagementId: result.engagementId,
            interactionId: result.interactionId,
            status: result.status,
        }
    }

    public async getRefactoringAssessmentStatus(
        params: GetRefactoringAssessmentStatusInput
    ): Promise<GetRefactoringAssessmentStatusResult> {
        const result = await this.callApi('getRefactoringAssessmentStatus', params)
        return {
            engagementId: result.engagementId,
            assessmentId: result.assessmentId,
            status: result.status,
            assessmentStatus: result.assessmentStatus,
        }
    }

    public async getRefactoringInteraction(
        params: GetRefactoringInteractionInput
    ): Promise<GetRefactoringInteractionResult> {
        const result = await this.callApi('getRefactoringInteraction', params)
        return {
            engagementId: result.engagementId,
            interactionId: result.interactionId,
            status: result.status,
            response: result.response,
        }
    }

    public async pollRefactoringAssessmentStatus(
        engagementId: string,
        assessmentId: string,
        currentStatus: string
    ): Promise<GetRefactoringAssessmentStatusResult> {
        let status: string = currentStatus
        let errors = 0
        let response

        do {
            // wait 5 seconds
            await new Promise(resolve => setTimeout(resolve, 5000))

            try {
                response = await this.getRefactoringAssessmentStatus({
                    engagementId,
                    assessmentId,
                })

                status = response.assessmentStatus
            } catch (error) {
                console.error(error)
                errors += 1

                if (errors >= 3) {
                    throw error
                }
            }
        } while (status === currentStatus)

        if (!response) {
            throw new Error('No response')
        }

        return response
    }

    public async pollRefactoringInteraction(
        engagementId: string,
        interactionId: string,
        currentStatus: string
    ): Promise<GetRefactoringInteractionResult> {
        let status: string = currentStatus
        let errors = 0
        let response

        do {
            // wait 5 seconds
            await new Promise(resolve => setTimeout(resolve, 5000))

            try {
                response = await this.getRefactoringInteraction({
                    engagementId,
                    interactionId,
                })

                status = response.status
            } catch (error) {
                console.error(error)
                errors += 1

                if (errors >= 3) {
                    throw error
                }
            }
        } while (status === currentStatus)

        if (!response) {
            throw new Error('No response')
        }

        return response
    }

    public async uploadWorkspace(engagementId: string) {
        const workspaceRoot = getWorkspaceRootDir()
        const { zipFileBuffer, contentChecksumSha256 } = await prepareRepoData(workspaceRoot)

        const createUploadUrlResponse = await this.createUploadUrl({
            engagementId,
            contentChecksumSha256,
        })

        // curl --upload-file
        await fetch(createUploadUrlResponse.signedUploadUrl, {
            method: 'PUT',
            body: zipFileBuffer,
            headers: createUploadUrlResponse.requestHeaders,
        })
    }

    public async downloadPlan(engagementId: string, assessmentId: string): Promise<string> {
        const createDownloadResult = await this.createDownloadUrl({
            engagementId,
            assessmentId,
            outputType: 'MD',
            contentType: 'ASSESSMENT',
        })

        // get text content
        const result = await fetch(createDownloadResult.signedDownloadUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        })

        const buffer = await result.arrayBuffer()
        const plan = new TextDecoder().decode(buffer)

        return plan
    }
}
