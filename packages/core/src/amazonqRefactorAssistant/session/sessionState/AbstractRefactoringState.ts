/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import * as path from 'path'
import * as vscode from 'vscode'
import { VirtualFileSystem } from '../../../shared/virtualFilesystem'
import { VirtualMemoryFile } from '../../../shared/virtualMemoryFile'
import { GetRefactoringAssessmentStatusResult } from '../../client/refactorAssistant'
import { SessionStateAction, SessionStateConfig, State } from '../../types'
import { ToolkitError } from '../../../shared/errors'
import { telemetry } from '../../../shared/telemetry/telemetry'
import {
    refactorAssistantScheme,
    analysisFinishedNotification,
    pdfName,
    TerminalStates,
    planGenerationMessage,
} from '../../constants'
import { fsCommon } from '../../../srcShared/fs'

export abstract class AbstractRefactoringState {
    protected cancelled = false

    async handlePlanExecution(
        action: SessionStateAction,
        tabID: string,
        config: SessionStateConfig,
        progressMessageId: string
    ): Promise<State> {
        action.messenger.sendUpdatePlaceholder(tabID, 'Generating implementation plan ...')

        let pollResponse: GetRefactoringAssessmentStatusResult
        let workflowStatus = ''

        try {
            do {
                pollResponse = await config.proxyClient.pollRefactoringAssessmentStatus(
                    config.engagementId,
                    config.assessmentId,
                    workflowStatus
                )

                if (this.cancelled) {
                    break
                }

                action.messenger.updateAnswer({
                    type: 'answer-stream',
                    tabID: tabID,
                    message: planGenerationMessage(pollResponse.assessmentStatus),
                    messageId: progressMessageId,
                })

                // If the plan hasn't finished yet, update user on progress, otherwise remove progress bar
                if (pollResponse && !TerminalStates.includes(pollResponse.status)) {
                    workflowStatus = pollResponse.status
                }
            } while (!TerminalStates.includes(pollResponse.status) && !this.cancelled)
        } catch (error) {
            action.messenger.sendUpdatePlaceholder(tabID, '')
            throw new ToolkitError('Revised plan generation has failed', { code: 'ServerError' })
        }

        if (this.cancelled) {
            action.messenger.sendUpdatePlaceholder(tabID, '')
            return 'StartOfConversation'
        }

        if (pollResponse === undefined || pollResponse.status === 'FAILED') {
            action.messenger.sendAnswer({
                type: 'answer',
                tabID: tabID,
                message: 'Plan generation failed.',
            })

            action.messenger.sendUpdatePlaceholder(tabID, '')
            throw new ToolkitError('Revised plan generation has failed', { code: 'ServerError' })
        } else if (pollResponse.status === 'CANCELLED') {
            action.messenger.sendAnswer({
                type: 'answer',
                tabID: tabID,
                message: 'Plan generation was cancelled.',
            })

            action.messenger.sendUpdatePlaceholder(tabID, '')
            throw new ToolkitError('Revised plan generation has been cancelled', { cancelled: true })
        }
        telemetry.record({
            reportStatus: pollResponse.status,
        })

        let plan: string = ''
        try {
            plan = await config.proxyClient.downloadPlan(config.engagementId, config.assessmentId)
        } catch (error) {
            action.messenger.sendUpdatePlaceholder(tabID, '')
            return 'ConversationErrored'
        }

        // PlanID in file name ensures unique naming for multiple versions of a plan
        const generationFilePath = path.join(`RA_PLAN_${config.assessmentId}.md`)
        const planUri = this.registerFile(plan, generationFilePath, tabID, action.fs)

        // Toast notification
        const userButtonSelectionThenable = vscode.window.showInformationMessage(
            analysisFinishedNotification.body,
            // Buttons
            analysisFinishedNotification.download,
            analysisFinishedNotification.view
        )

        void userButtonSelectionThenable.then((userButtonSelection: any) => {
            if (userButtonSelection === analysisFinishedNotification.view) {
                // To view in browser:
                // await vscode.env.openExternal(vscode.Uri.parse(plan))
                void vscode.commands.executeCommand('vscode.open', plan)
            } else if (userButtonSelection === analysisFinishedNotification.download) {
                const saveOptions: vscode.SaveDialogOptions = {
                    defaultUri: vscode.Uri.parse(pdfName(config.assessmentId)),
                }
                void vscode.window.showSaveDialog(saveOptions).then(async fileUri => {
                    if (fileUri) {
                        const plan = await config.proxyClient.downloadPlan(config.engagementId, config.assessmentId)
                        await fsCommon.writeFile(fileUri.fsPath, plan)
                    }
                })
            }
        })

        action.messenger.updateAnswer({
            type: 'answer',
            tabID: tabID,
            messageId: progressMessageId,
            message: `Your Refactor analysis is ready! You can review it by opening the Markdown file: [here](${planUri})

You can also ask me any follow-up questions that you have or adjust any part by generating a revised analysis.`,
            followUp: {
                text: 'Try Examples:',
                options: [
                    {
                        pillText: 'Explain Output Validation Metrics',
                        prompt: 'explain analysis',
                    },
                    {
                        pillText: 'Explain recommended microservices',
                        prompt: 'explain analysis',
                    },
                    {
                        pillText: 'Generate a revised analysis',
                        prompt: 'revise analysis',
                    },
                ],
            },
            buttons: [
                {
                    text: 'Download PDF',
                    id: 'download-pdf',
                    status: 'info',
                    disabled: false, // Explicitly set to false so button isn't disabled on click
                },
            ],
            finalUpdate: true,
            canBeVoted: true,
        })

        action.messenger.sendUpdatePlaceholder(tabID, '')
        action.messenger.sendChatInputEnabled(tabID, true)
        return 'PlanGenerationFollowup'
    }

    private registerFile(contents: string, filePath: string, tabID: string, fs: VirtualFileSystem): vscode.Uri {
        const encoder = new TextEncoder()
        const encodedContents = encoder.encode(contents)
        const uri = vscode.Uri.from({
            scheme: refactorAssistantScheme,
            path: filePath,
            query: `tabID=${tabID}`,
        })
        fs.registerProvider(uri, new VirtualMemoryFile(encodedContents))
        return uri
    }
}
