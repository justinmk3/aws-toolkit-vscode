/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs'
import request from '../../common/request'

// TODO : update this when full api contract is ready: https://quip-amazon.com/PpOtAsQ5ekh5/RA-API-Design#temp:C:baR45f3e650b40547a087c967d82
type CreateEngagementResult = {
    engagementId: string
}

type CreateUploadUrlResult = {
    presignedUrl: string
}

type CreateDownloadUrlResult = {
    s3url: string
}

type DeriveUserIntentResult = {
    intent: 'explain analysis' | 'revise analysis' | 'new analysis'
}

type StartRefactoringAssessmentResult = {
    assessmentId: string
    workflowStatus: string
}

type GetRefactoringAssessmentStatusResult = {
    workflowStatus: string
    assessmentStatus: string
}

type UpdateRefactoringAssessmentResult = {
    workflowStatus: string
}

type StopRefactoringAssessmentResult = {
    workflowStatus: string
}

type StartRefactoringInteractionResult = {
    interactionId: string
    workflowStatus: string
}

type GetRefactoringInteractionResult = {
    response: string
    workflowStatus: string
}

export class RefactorAssistantClient {
    // TODO: this is temporary until s3 functionality is built
    public async uploadCode(zipFileBuffer: Buffer) {
        try {
            const body = JSON.stringify({ zipFile: zipFileBuffer.toString('base64') })
            const response = await request.fetch('POST', 'http://localhost:3030/upload', {
                body,
                headers: {
                    'Content-Type': 'application/json',
                },
            }).response

            return response.json()
        } catch (error) {
            console.error(error)
            throw error
        }
    }

    public async createEngagement(prompt: string): Promise<CreateEngagementResult> {
        try {
            // TODO : add client metadata
            const body = JSON.stringify({
                clientMetadata: {},
            })
            const response = await request.fetch('POST', 'http://localhost:3030/CreateEngagement', {
                body,
                headers: {
                    'Content-Type': 'application/json',
                },
            }).response

            const json = await response.json()

            return {
                engagementId: json.engagementId,
            }
        } catch (error) {
            console.error(error)
            throw error
        }
    }

    public async deleteEngagement(engagementId: string): Promise<void> {
        try {
            // TODO : add client metadata
            const body = JSON.stringify({
                engagementId,
                clientMetadata: {},
            })
            await request.fetch('POST', 'http://localhost:3030/DeleteEngagement', {
                body,
                headers: {
                    'Content-Type': 'application/json',
                },
            }).response
        } catch (error) {
            console.error(error)
            throw error
        }
    }

    public async createUploadUrl(engagementId: string): Promise<CreateUploadUrlResult> {
        try {
            // TODO : add client metadata and checksum
            const body = JSON.stringify({
                engagementId,
                clientMetadata: {},
                contentChecksum: '',
            })
            const response = await request.fetch('POST', 'http://localhost:3030/CreateUploadUri', {
                body,
                headers: {
                    'Content-Type': 'application/json',
                },
            }).response

            const json = await response.json()

            return {
                presignedUrl: json.PresignedUrl,
            }
        } catch (error) {
            console.error(error)
            throw error
        }
    }

    public async createDownloadUrl(engagementId: string): Promise<CreateDownloadUrlResult> {
        try {
            // TODO : add client metadata, checksum, contentType, and assessmentId
            const body = JSON.stringify({
                engagementId,
                clientMetadata: {},
                contentType: '',
                contentChecksum: '',
            })
            const response = await request.fetch('POST', 'http://localhost:3030/CreateDownloadUrl', {
                body,
                headers: {
                    'Content-Type': 'application/json',
                },
            }).response

            const json = await response.json()

            return {
                s3url: json.s3url,
            }
        } catch (error) {
            console.error(error)
            throw error
        }
    }

    public async deriveUserIntent(engagementId: string, chatMessage: string): Promise<DeriveUserIntentResult> {
        try {
            // TODO : add client metadata
            const body = JSON.stringify({
                engagementId,
                chatMessage,
                clientMetadata: {},
            })
            const response = await request.fetch('POST', 'http://localhost:3030/DeriveUserIntent', {
                body,
                headers: {
                    'Content-Type': 'application/json',
                },
            }).response

            const json = await response.json()

            return {
                intent: json.intent,
            }
        } catch (error) {
            console.error(error)
            throw error
        }
    }

    public async startRefactoringAssessment(
        engagementId: string,
        chatMessage: string,
        outputType: 'pdf' | 'markdown'
    ): Promise<StartRefactoringAssessmentResult> {
        try {
            // TODO : add client metadata
            const body = JSON.stringify({
                engagementId,
                chatMessage,
                outputType,
                clientMetadata: {},
            })
            const response = await request.fetch('POST', 'http://localhost:3030/StartRefactoringAssessment', {
                body,
                headers: {
                    'Content-Type': 'application/json',
                },
            }).response

            const json = await response.json()

            return {
                assessmentId: json.assessmentId,
                workflowStatus: json.workflowStatus,
            }
        } catch (error) {
            console.error(error)
            throw error
        }
    }

    public async getRefactoringAssessmentStatus(
        engagementId: string,
        assessmentId: string
    ): Promise<GetRefactoringAssessmentStatusResult> {
        try {
            // TODO : add client metadata
            const body = JSON.stringify({
                engagementId,
                assessmentId,
                clientMetadata: {},
            })
            const response = await request.fetch('POST', 'http://localhost:3030/GetRefactoringAssessmentStatus', {
                body,
                headers: {
                    'Content-Type': 'application/json',
                },
            }).response

            const json = await response.json()

            return {
                workflowStatus: json.workflowStatus,
                assessmentStatus: json.assessmentStatus,
            }
        } catch (error) {
            console.error(error)
            throw error
        }
    }

    public async updateRefactoringAssessment(
        engagementId: string,
        assessmentId: string,
        chatMessage: string
    ): Promise<UpdateRefactoringAssessmentResult> {
        try {
            // TODO : add client metadata
            const body = JSON.stringify({
                engagementId,
                assessmentId,
                chatMessage,
                clientMetadata: {},
            })
            const response = await request.fetch('POST', 'http://localhost:3030/UpdateRefactoringAssessment', {
                body,
                headers: {
                    'Content-Type': 'application/json',
                },
            }).response

            const json = await response.json()

            return {
                workflowStatus: json.workflowStatus,
            }
        } catch (error) {
            console.error(error)
            throw error
        }
    }

    public async stopRefactoringAssessment(
        engagementId: string,
        assessmentId: string
    ): Promise<StopRefactoringAssessmentResult> {
        try {
            // TODO : add client metadata
            const body = JSON.stringify({
                engagementId,
                assessmentId,
                clientMetadata: {},
            })
            const response = await request.fetch('POST', 'http://localhost:3030/StopRefactoringAssessment', {
                body,
                headers: {
                    'Content-Type': 'application/json',
                },
            }).response

            const json = await response.json()

            return {
                workflowStatus: json.workflowStatus,
            }
        } catch (error) {
            console.error(error)
            throw error
        }
    }

    public async startRefactoringInteraction(
        engagementId: string,
        chatMessage: string
    ): Promise<StartRefactoringInteractionResult> {
        try {
            // TODO : add client metadata
            const body = JSON.stringify({
                engagementId,
                chatMessage,
                clientMetadata: {},
            })
            const response = await request.fetch('POST', 'http://localhost:3030/StartRefactoringInteraction', {
                body,
                headers: {
                    'Content-Type': 'application/json',
                },
            }).response

            const json = await response.json()

            return {
                workflowStatus: json.workflowStatus,
                interactionId: json.interactionId,
            }
        } catch (error) {
            console.error(error)
            throw error
        }
    }

    public async getRefactoringInteraction(
        engagementId: string,
        interactionId: string
    ): Promise<GetRefactoringInteractionResult> {
        try {
            // TODO : add client metadata
            const body = JSON.stringify({
                engagementId,
                interactionId,
                clientMetadata: {},
            })
            const response = await request.fetch('POST', 'http://localhost:3030/GetRefactoringInteraction', {
                body,
                headers: {
                    'Content-Type': 'application/json',
                },
            }).response

            const json = await response.json()

            return {
                response: json.response,
                workflowStatus: json.workflowStatus,
            }
        } catch (error) {
            console.error(error)
            throw error
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
                response = await this.getRefactoringAssessmentStatus(engagementId, assessmentId)

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
        assessmentId: string,
        currentStatus: string
    ): Promise<GetRefactoringInteractionResult> {
        let status: string = currentStatus
        let errors = 0
        let response

        do {
            // wait 5 seconds
            await new Promise(resolve => setTimeout(resolve, 5000))

            try {
                response = await this.getRefactoringInteraction(engagementId, assessmentId)

                status = response.workflowStatus
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

    public async downloadFile(recommendationId: string, filePath: string) {
        const response = await request.fetch('GET', `http://localhost:3030/download/${recommendationId}`).response
        const blob = await response.blob()
        const arrayBuffer = await blob.arrayBuffer()
        fs.appendFileSync(filePath, Buffer.from(arrayBuffer))
    }
}
