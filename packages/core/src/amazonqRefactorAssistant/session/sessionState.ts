/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import * as path from 'path'
import * as vscode from 'vscode'
import { SessionState, SessionStateAction, SessionStateConfig, SessionStateInteraction } from '../types'
import { getWorkspaceRootDir, prepareRepoData } from '../util/files'
import { VirtualFileSystem } from '../../shared/virtualFilesystem'
import { VirtualMemoryFile } from '../../shared/virtualMemoryFile'
import { analysisFinishedNotification, defaultPdfName } from '../constants'
import { refactorAssistantScheme } from '../constants'
import { v4 as uuidv4 } from 'uuid'
import { Messenger } from '../controllers/chat/messenger/messenger'

const TerminalStates = ['succeeded', 'failed', 'cancelled']

export class ConversationNotStartedState implements Omit<SessionState, 'uploadId'> {
    constructor(public tabID: string) {}

    async interact(_action: SessionStateAction): Promise<SessionStateInteraction> {
        // TODO: Add custom errors
        throw new Error('Illegal State Transition')
    }
}

export class StartOfConversation implements Omit<SessionState, 'uploadId'> {
    constructor(private config: Omit<SessionStateConfig, 'uploadId'>, public tabID: string) {}

    async interact(action: SessionStateAction): Promise<SessionStateInteraction> {
        action.messenger.sendAnswer({
            type: 'answer',
            tabID: this.tabID,
            message: `No problem! Before I start, is there any other requirements you would want me to consider while generating your refactoring requirements?`,
            followUp: {
                text: 'Try Examples:',
                options: [
                    {
                        pillText: 'Describe the core functionalities of the monolithic application',
                        prompt: 'Describe the core functionalities of the monolithic application',
                    },
                    {
                        pillText: "No, let's start",
                        prompt: "No, let's start",
                    },
                ],
            },
        })

        const nextState = new GenerateInitialPlan(this.config, action.msg, this.tabID)
        return { nextState }
    }
}

export class ConversationErrored implements Omit<SessionState, 'uploadId'> {
    constructor(public tabID: string) {}

    async interact(action: SessionStateAction): Promise<SessionStateInteraction> {
        action.messenger.sendAnswer({
            type: 'answer',
            tabID: this.tabID,
            message: 'Sorry, something went wrong. Please try again.',
        })

        const nextState = new ConversationNotStartedState(this.tabID)
        return { nextState }
    }
}

export abstract class RefactoringState {
    async handlePlanExecution(
        action: SessionStateAction,
        tabID: string,
        config: SessionStateConfig
    ): Promise<SessionStateInteraction> {
        // Ensure that the loading icon stays showing
        const progressMessageId = uuidv4()
        action.messenger.sendInitalStream(tabID, progressMessageId, `Generating plan...`)
        action.messenger.sendUpdatePlaceholder(tabID, 'Generating implementation plan ...')

        let pollResponse
        let workflowStatus = ''

        try {
            do {
                pollResponse = await config.proxyClient.pollRefactoringAssessmentStatus(
                    config.engagementId,
                    config.assessmentId,
                    workflowStatus
                )

                // If the plan hasn't finished yet, update user on progress, otherwise remove progress bar
                if (pollResponse && !TerminalStates.includes(pollResponse.workflowStatus)) {
                    workflowStatus = pollResponse.workflowStatus

                    action.messenger.updateAnswer({
                        type: 'answer-stream',
                        tabID: tabID,
                        message: pollResponse.assessmentStatus,
                        messageId: progressMessageId,
                    })
                } else if (pollResponse) {
                    action.messenger.updateAnswer({
                        type: 'answer-stream',
                        tabID: tabID,
                        message: '',
                        messageId: progressMessageId,
                    })
                }
            } while (!TerminalStates.includes(pollResponse.workflowStatus))
        } catch (error) {
            action.messenger.sendUpdatePlaceholder(tabID, '')
            const errorState = new ConversationErrored(tabID)
            return errorState.interact(action)
        }

        if (pollResponse === undefined || pollResponse.workflowStatus === 'failed') {
            action.messenger.sendAnswer({
                type: 'answer',
                tabID: tabID,
                message: 'Plan generation failed.',
            })

            action.messenger.sendUpdatePlaceholder(tabID, '')
            const nextState = new StartOfConversation(config, tabID)
            return { nextState }
        } else if (pollResponse.workflowStatus === 'cancelled') {
            action.messenger.sendAnswer({
                type: 'answer',
                tabID: tabID,
                message: 'Plan generation was cancelled.',
            })

            action.messenger.sendUpdatePlaceholder(tabID, '')
            const nextState = new StartOfConversation(config, tabID)
            return { nextState }
        }

        // TODO: Use plan id from API or use version of plan number
        const planID = uuidv4()
        // PlanID in file name ensures unique naming for multiple versions of a plan
        const generationFilePath = path.join(`RA_PLAN_${planID}.md`)

        let createDownloadResult
        try {
            // TODO: For out temp dev server we are assuming the s3url string contains our plan. We need to update this to
            //      use s3 once that functionality is built server side.
            createDownloadResult = await config.proxyClient.createDownloadUrl(config.engagementId)
        } catch (error) {
            action.messenger.sendUpdatePlaceholder(tabID, '')
            const errorState = new ConversationErrored(tabID)
            return errorState.interact(action)
        }
        const plan = createDownloadResult.s3url

        const planUri = registerFile(plan, generationFilePath, tabID, action.fs)

        // TODO: add the preview for the plan here instead of the entire plan
        action.messenger.sendAnswer({
            type: 'answer',
            tabID: tabID,
            message: plan,
            canBeVoted: true,
        })

        // TODO: this should be part of the preview component
        // Download button in chat window
        action.messenger.sendAnswer({
            type: 'answer',
            tabID: tabID,
            message: 'Download Options',
            buttons: [
                {
                    text: 'Download PDF',
                    id: 'download-pdf',
                    status: 'info',
                    disabled: false, // Explicitly set to false so button isn't disabled on click
                },
            ],
        })

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
                    defaultUri: vscode.Uri.parse(defaultPdfName),
                }
                void vscode.window.showSaveDialog(saveOptions).then((e: any) => {})
                // .then(async fileUri => {
                //     if (fileUri) {
                //         // TODO: ConversationId should be retrieved from session state
                //         // TODO: Uncomment this when downloading is done via a URL and doesn't require RefactorClient
                //         //await downloadFile(this.conversationId, fileUri.fsPath)
                //     }
                // })
            }
        })

        action.messenger.sendAnswer({
            type: 'answer',
            tabID: tabID,
            message: `Your Refactor Assistant analysis is ready! You can download the PDF version above. A local markdown version is available [here](${planUri}).
            
        You can ask me any follow up questions you may have or adjust any part by generating a revised analysis.`,
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
        })

        action.messenger.sendUpdatePlaceholder(tabID, '')
        const nextState = new PlanGenerationFollowup(config, tabID)
        return { nextState }
    }
}

export class GenerateInitialPlan extends RefactoringState implements SessionState {
    private progressMessageId?: string

    constructor(private config: SessionStateConfig, private prompt: string, public tabID: string) {
        super()
    }

    async interact(action: SessionStateAction): Promise<SessionStateInteraction> {
        action.messenger.sendAnswer({
            type: 'answer',
            tabID: this.tabID,
            message: `Ok, let me create a plan. This may take a few minutes`,
        })

        // TODO: once server s3 functionality is implemented we need to use that instead
        // upload code
        const workspaceRoot = getWorkspaceRootDir()
        const { zipFileBuffer } = await prepareRepoData(workspaceRoot)
        try {
            const response = await this.config.proxyClient.uploadCode(zipFileBuffer)
            this.config.engagementId = response.conversationId
        } catch (error) {
            const errorState = new ConversationErrored(this.tabID)
            return errorState.interact(action)
        }

        try {
            const startRefactoringResponse = await this.config.proxyClient.startRefactoringAssessment(
                this.config.engagementId,
                this.prompt + action.msg,
                'markdown'
            )
            this.config.assessmentId = startRefactoringResponse.assessmentId
        } catch (error) {
            const errorState = new ConversationErrored(this.tabID)
            return errorState.interact(action)
        }

        return this.handlePlanExecution(action, this.tabID, this.config)
    }

    async cancel(messenger: Messenger) {
        try {
            await this.config.proxyClient.stopRefactoringAssessment(this.config.engagementId, this.config.assessmentId)

            if (this.progressMessageId) {
                messenger.updateAnswer({
                    type: 'answer-stream',
                    tabID: this.tabID,
                    message: 'Cancelling plan generation',
                    messageId: this.progressMessageId,
                })
            }
        } catch (error) {
            // swallow this exception, as if our cancellation request fails it's better to just not cancel
            console.error(error)
        }
    }
}

export class RevisePlan extends RefactoringState implements SessionState {
    private progressMessageId?: string

    constructor(private config: SessionStateConfig, public tabID: string) {
        super()
    }

    async interact(action: SessionStateAction): Promise<SessionStateInteraction> {
        action.messenger.sendAnswer({
            type: 'answer',
            tabID: this.tabID,
            message: `Ok, let me revise the plan. This may take a few minutes`,
        })

        try {
            await this.config.proxyClient.updateRefactoringAssessment(
                this.config.engagementId,
                this.config.assessmentId,
                action.msg
            )
        } catch (error) {
            const errorState = new ConversationErrored(this.tabID)
            return errorState.interact(action)
        }

        return this.handlePlanExecution(action, this.tabID, this.config)
    }

    async cancel(messenger: Messenger) {
        try {
            await this.config.proxyClient.stopRefactoringAssessment(this.config.engagementId, this.config.assessmentId)

            if (this.progressMessageId) {
                messenger.updateAnswer({
                    type: 'answer-stream',
                    tabID: this.tabID,
                    message: 'Cancelling plan generation',
                    messageId: this.progressMessageId,
                })
            }
        } catch (error) {
            // swallow this exception, as if our cancellation request fails it's better to just not cancel
            console.error(error)
        }
    }
}

export class PlanGenerationFollowup extends RefactoringState implements SessionState {
    private progressMessageId?: string

    constructor(private config: SessionStateConfig, public tabID: string) {
        super()
    }

    async explain(action: SessionStateAction): Promise<SessionStateInteraction> {
        // Ensure that the loading icon stays showing
        this.progressMessageId = uuidv4()
        action.messenger.sendInitalStream(this.tabID, this.progressMessageId, `Generating response...`)
        action.messenger.sendUpdatePlaceholder(this.tabID, 'Generating response ...')

        let pollResponse
        let workflowStatus = ''

        try {
            const startInteractionResponse = await this.config.proxyClient.startRefactoringInteraction(
                this.config.engagementId,
                action.msg
            )
            const interactionId = startInteractionResponse.interactionId
            workflowStatus = startInteractionResponse.workflowStatus

            do {
                pollResponse = await this.config.proxyClient.pollRefactoringInteraction(
                    this.config.engagementId,
                    interactionId,
                    workflowStatus
                )

                if (pollResponse && !TerminalStates.includes(pollResponse.workflowStatus)) {
                    workflowStatus = pollResponse.workflowStatus

                    action.messenger.updateAnswer({
                        type: 'answer-stream',
                        tabID: this.tabID,
                        message: pollResponse.workflowStatus,
                        messageId: this.progressMessageId,
                    })
                }
            } while (!TerminalStates.includes(pollResponse.workflowStatus))

            action.messenger.sendAnswer({
                type: 'answer',
                tabID: this.tabID,
                message: pollResponse.response,
                canBeVoted: true,
            })

            action.messenger.sendAnswer({
                type: 'answer',
                tabID: this.tabID,
                message: `Would you like to ask another follow up?
    
You can ask me any follow up questions you may have or adjust any part by generating a revised analysis.`,
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
            })

            const nextState = new PlanGenerationFollowup(this.config, this.tabID)
            return { nextState }
        } catch (error) {
            const errorState = new ConversationErrored(this.tabID)
            return errorState.interact(action)
        }
    }

    async revise(action: SessionStateAction): Promise<SessionStateInteraction> {
        action.messenger.sendAnswer({
            type: 'answer',
            tabID: this.tabID,
            message: `No problem! Before I start, are there any aspects of the plan you would like me to focus on for the next revision?`,
            followUp: {
                text: 'Try Examples:',
                options: [
                    {
                        pillText: 'Optimize for costs',
                        prompt: 'Optimize for costs',
                    },
                    {
                        pillText: 'Break apart responsibilities into more distinct domains',
                        prompt: 'Break apart responsibilities into more distinct domains',
                    },
                ],
            },
        })

        const nextState = new RevisePlan(this.config, this.tabID)
        return { nextState }
    }

    async newPlan(action: SessionStateAction): Promise<SessionStateInteraction> {
        action.messenger.sendAnswer({
            type: 'answer',
            tabID: this.tabID,
            message: `No problem! Before I start, is there any other requirements you would want me to consider while generating your refactoring requirements?`,
            followUp: {
                text: 'Try Examples:',
                options: [
                    {
                        pillText: 'Describe the core functionalities of the monolithic application',
                        prompt: 'Describe the core functionalities of the monolithic application',
                    },
                    {
                        pillText: "No, let's start",
                        prompt: "No, let's start",
                    },
                ],
            },
        })

        const nextState = new GenerateInitialPlan(this.config, action.msg, this.tabID)
        return { nextState }
    }

    async interact(action: SessionStateAction): Promise<SessionStateInteraction> {
        const deriveIntentResult = await this.config.proxyClient.deriveUserIntent(this.config.engagementId, action.msg)

        if (deriveIntentResult.intent === 'explain analysis') {
            return this.explain(action)
        } else if (deriveIntentResult.intent === 'revise analysis') {
            return this.revise(action)
        } else if (deriveIntentResult.intent === 'new analysis') {
            return this.newPlan(action)
        }

        action.messenger.sendAnswer({
            type: 'answer',
            tabID: this.tabID,
            message: `I'm sorry, I don't understand your response. 

You can ask me any follow up questions you may have or adjust any part by generating a revised analysis.`,
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
        })

        const nextState = new PlanGenerationFollowup(this.config, this.tabID)

        return { nextState }
    }
}

function registerFile(contents: string, filePath: string, tabID: string, fs: VirtualFileSystem): vscode.Uri {
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
