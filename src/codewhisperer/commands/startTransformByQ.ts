/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from 'vscode'
import * as nls from 'vscode-nls'
import * as fs from 'fs'
import * as os from 'os'
import { getLogger } from '../../shared/logger'
import * as CodeWhispererConstants from '../models/constants'
import { transformByQState, StepProgress, DropdownStep, TransformByQReviewStatus } from '../models/model'
import { cancel } from '../../shared/localizedText'
import {
    throwIfCancelled,
    startJob,
    stopJob,
    uploadPayload,
    getTransformationPlan,
    zipCode,
    pollTransformationJob,
    convertToTimeString,
    convertDateToTimestamp,
    getValidModules,
} from '../service/transformByQHandler'
import { QuickPickItem } from 'vscode'
import { MultiStepInputFlowController } from '../../shared//multiStepInputFlowController'
import path from 'path'

const localize = nls.loadMessageBundle()
export const stopTransformByQButton = localize('aws.codewhisperer.stop.transform.by.q', 'Stop Transform by Q')

let sessionJobHistory: { timestamp: string; module: string; status: string; duration: string; id: string }[] = []

const sessionPlanProgress: {
    uploadCode: StepProgress
    buildCode: StepProgress
    transformCode: StepProgress
    returnCode: StepProgress
} = {
    uploadCode: StepProgress.NotStarted,
    buildCode: StepProgress.NotStarted,
    transformCode: StepProgress.NotStarted,
    returnCode: StepProgress.NotStarted,
}

// TO-DO: consider adding progress bar here; for now not using one but keeping this function still; context will be used later to handle IDE restart
export async function startTransformByQWithProgress() {
    await startTransformByQ()
}

interface UserInputState {
    title: string
    step: number
    totalSteps: number
    targetLanguage: QuickPickItem
    targetVersion: QuickPickItem
    module: QuickPickItem
}

async function collectInputs(validModules: vscode.QuickPickItem[] | undefined) {
    // const targetLanguages: QuickPickItem[] = CodeWhispererConstants.targetLanguages.map(label => ({ label }))
    const state = {} as Partial<UserInputState>
    // only supporting target language of Java and target version of JDK17 for now, so skip to pickModule prompt
    transformByQState.setTargetJDKVersionToJDK17()
    await MultiStepInputFlowController.run(input => pickModule(input, state, validModules))
    // await MultiStepInputFlowController.run(input => pickTargetLanguage(input, state, targetLanguages, validModules))
    return state as UserInputState
}

async function pickModule(
    input: MultiStepInputFlowController,
    state: Partial<UserInputState>,
    validModules: vscode.QuickPickItem[] | undefined
) {
    const pick = await input.showQuickPick({
        title: CodeWhispererConstants.transformByQWindowTitle,
        step: DropdownStep.STEP_1,
        totalSteps: DropdownStep.STEP_1,
        placeholder: CodeWhispererConstants.selectModulePrompt,
        items: validModules!,
        shouldResume: () => Promise.resolve(true),
        ignoreFocusOut: false,
    })
    state.module = pick
}

export async function startTransformByQ() {
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms * 1000))

    let validModules: vscode.QuickPickItem[] | undefined
    try {
        validModules = await getValidModules()
    } catch (err) {
        getLogger().error('Failed to get valid modules: ', err)
        throw err
    }

    // TODO: if only 1 workspace module open, skip collectInputs

    const state = await collectInputs(validModules)

    const selection = await vscode.window.showWarningMessage(
        CodeWhispererConstants.dependencyDisclaimer,
        'Transform',
        'Cancel'
    )

    if (selection !== 'Transform') {
        return
    }

    vscode.commands.executeCommand('setContext', 'gumby.isStopButtonAvailable', true)
    vscode.commands.executeCommand('setContext', 'gumby.isTransformAvailable', false)
    vscode.commands.executeCommand('setContext', 'gumby.isPlanAvailable', false)

    resetReviewInProgress()

    const startTime = new Date()

    sessionPlanProgress['uploadCode'] = StepProgress.Pending
    sessionPlanProgress['buildCode'] = StepProgress.Pending
    sessionPlanProgress['transformCode'] = StepProgress.Pending
    sessionPlanProgress['returnCode'] = StepProgress.Pending

    let intervalId = undefined
    let errorMessage = ''
    try {
        intervalId = setInterval(() => {
            vscode.commands.executeCommand('aws.amazonq.showPlanProgressInHub')
        }, CodeWhispererConstants.progressIntervalMs)
        // step 1: CreateCodeUploadUrl and upload code
        transformByQState.setToRunning()
        await vscode.commands.executeCommand('aws.amazonq.refresh')
        await vscode.commands.executeCommand('aws.amazonq.transformationHub.focus')

        let uploadId = ''
        throwIfCancelled()
        try {
            const payloadFileName = await zipCode(state.module.description!)
            uploadId = await uploadPayload(payloadFileName)
        } catch (error) {
            errorMessage = 'Failed to zip code and upload it to S3'
            throw error // do not log the error due to security issues (may contain the uploadUrl)
        }
        sessionPlanProgress['uploadCode'] = StepProgress.Succeeded
        await vscode.commands.executeCommand('aws.amazonq.refresh')

        // step 2: StartJob and store the returned jobId in TransformByQState
        throwIfCancelled()
        let jobId = ''
        try {
            jobId = await startJob(uploadId)
        } catch (error) {
            errorMessage = 'Failed to start job'
            getLogger().error(errorMessage, error)
            throw error
        }
        transformByQState.setJobId(jobId)
        await vscode.commands.executeCommand('aws.amazonq.refresh')

        // intermediate step: show transformation-plan.md file
        // TO-DO: on IDE restart, resume here if a job was ongoing
        try {
            await pollTransformationJob(jobId, CodeWhispererConstants.validStatesForGettingPlan)
        } catch (error) {
            errorMessage = 'Failed to poll transformation job for plan availability, or job itself failed'
            getLogger().error(errorMessage, error)
            throw error
        }
        let plan = undefined
        try {
            plan = await getTransformationPlan(jobId)
        } catch (error) {
            errorMessage = 'Failed to get transformation plan'
            getLogger().error(errorMessage, error)
            throw error
        }
        sessionPlanProgress['buildCode'] = StepProgress.Succeeded
        const filePath = path.join(os.tmpdir(), 'transformation-plan.md')
        fs.writeFileSync(filePath, plan)
        vscode.commands.executeCommand('markdown.showPreview', vscode.Uri.file(filePath))
        transformByQState.setPlanFilePath(filePath)
        vscode.commands.executeCommand('setContext', 'gumby.isPlanAvailable', true)

        // step 3: poll until artifacts are ready to download
        throwIfCancelled()
        let status = ''
        try {
            status = await pollTransformationJob(jobId, CodeWhispererConstants.validStatesForCheckingDownloadUrl)
        } catch (error) {
            errorMessage = 'Failed to poll transformation job for status'
            getLogger().error(errorMessage, error)
            throw error
        }

        if (!(status === 'COMPLETED' || status === 'PARTIALLY_COMPLETED')) {
            errorMessage = 'Failed to complete modernization'
            getLogger().error(errorMessage)
            sessionPlanProgress['transformCode'] = StepProgress.Failed
            throw new Error(errorMessage)
        }

        sessionPlanProgress['transformCode'] = StepProgress.Succeeded
        transformByQState.setToSucceeded()
        if (status === 'PARTIALLY_COMPLETED') {
            transformByQState.setToPartiallySucceeded()
        }

        await vscode.commands.executeCommand('aws.amazonq.transformationHub.reviewChanges.reveal')
        await vscode.commands.executeCommand('aws.amazonq.refresh')
        sessionPlanProgress['returnCode'] = StepProgress.Succeeded
    } catch (error) {
        if (transformByQState.isCancelled()) {
            stopJob(transformByQState.getJobId())
            vscode.window.showErrorMessage(CodeWhispererConstants.transformByQCancelledMessage)
        } else {
            transformByQState.setToFailed()
            let displayedErrorMessage = CodeWhispererConstants.transformByQFailedMessage
            if (errorMessage !== '') {
                displayedErrorMessage += ': ' + errorMessage
            }
            vscode.window.showErrorMessage(displayedErrorMessage)
        }
        if (sessionPlanProgress['uploadCode'] !== StepProgress.Succeeded) {
            sessionPlanProgress['uploadCode'] = StepProgress.Failed
        }
        if (sessionPlanProgress['buildCode'] !== StepProgress.Succeeded) {
            sessionPlanProgress['buildCode'] = StepProgress.Failed
        }
        if (sessionPlanProgress['transformCode'] !== StepProgress.Succeeded) {
            sessionPlanProgress['transformCode'] = StepProgress.Failed
        }
        if (sessionPlanProgress['returnCode'] !== StepProgress.Succeeded) {
            sessionPlanProgress['returnCode'] = StepProgress.Failed
        }
    } finally {
        vscode.commands.executeCommand('setContext', 'gumby.isTransformAvailable', true)
        const durationInMs = new Date().getTime() - startTime.getTime()
        if (state.module) {
            sessionJobHistory = processHistory(
                sessionJobHistory,
                convertDateToTimestamp(startTime),
                state.module.label,
                transformByQState.getStatus(),
                convertToTimeString(durationInMs),
                transformByQState.getJobId()
            )
        }
        if (transformByQState.isSucceeded()) {
            vscode.window.showInformationMessage(CodeWhispererConstants.transformByQCompleted)
        }
        await sleep(1) // needed as a buffer to allow TransformationHub to update before state is updated
        clearInterval(intervalId)
        transformByQState.setToNotStarted() // so that the "Transform by Q" button resets
        await vscode.commands.executeCommand('aws.amazonq.refresh')
    }
}

export function processHistory(
    sessionJobHistory: { timestamp: string; module: string; status: string; duration: string; id: string }[],
    startTime: string,
    module: string,
    status: string,
    duration: string,
    id: string
) {
    sessionJobHistory = [] // reset job history; only storing the last run for now
    const copyState = { timestamp: startTime, module: module, status: status, duration: duration, id: id }
    sessionJobHistory.push(copyState)
    return sessionJobHistory
}

export function getJobHistory() {
    return sessionJobHistory
}

export function getPlanProgress() {
    return sessionPlanProgress
}

export async function confirmStopTransformByQ(jobId: string) {
    const resp = await vscode.window.showWarningMessage(
        CodeWhispererConstants.stopTransformByQMessage,
        stopTransformByQButton,
        cancel
    )
    if (resp === stopTransformByQButton && transformByQState.isRunning()) {
        getLogger().verbose('User requested to stop transform by Q. Stopping transform by Q.')
        transformByQState.setToCancelled()
        await vscode.commands.executeCommand('aws.amazonq.refresh')
        vscode.window.showInformationMessage(CodeWhispererConstants.stoppingTransformByQMessage)
        vscode.commands.executeCommand('setContext', 'gumby.isStopButtonAvailable', false)
        stopJob(jobId)
    }
}

function resetReviewInProgress() {
    vscode.commands.executeCommand('setContext', 'gumby.reviewState', TransformByQReviewStatus.NotStarted)
    vscode.commands.executeCommand('setContext', 'gumby.transformationProposalReviewInProgress', false)
}