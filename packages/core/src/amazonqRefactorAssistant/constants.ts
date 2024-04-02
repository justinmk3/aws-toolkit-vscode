/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

// The Scheme name of the virtual documents.
export const refactorAssistantScheme = 'aws-refactor'

// For uniquely identifiying which chat messages should be routed to RefactorAssistant
export const refactorAssistant = 'refactorAssistant'

export const featureName = 'Amazon Q Refactor Assistant'

export const analysisFinishedNotification = {
    body: `Your Amazon Q Refactor Assistant analysis is completed. You can view the report right now and ask Q more about refactoring.`,

    download: 'Download PDF',
    view: 'View Plan Markdown',
}

export const defaultPdfName = 'RA_PLAN.pdf'
