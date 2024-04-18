/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ChatItemBodyRenderer } from '@aws/mynah-ui'
import { WorkflowStatus } from './client/refactorAssistant'

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

export const pdfName = (id: string) => `Q_refactor_analysis_${id}.pdf`

export const planGenerationMessage = (
    status: string
) => `You got it! Generating your analysis. This might take more than 20 minutes depending on your workspace size. I will send you a notification when the analysis is ready.

${status}`

export const TerminalStates: WorkflowStatus[] = ['COMPLETED', 'FAILED', 'CANCELLED']

export const planPreviewHtml: (onMarkdownClick: () => null) => ChatItemBodyRenderer[] = onMarkdownClick => [
    {
        type: 'p',
        children: [
            'Your Refactor analysis is ready! You can review it by opening the Markdown file: ',
            {
                type: 'a',
                href: '#',
                events: {
                    click: (event: MouseEvent) => {
                        onMarkdownClick()
                    },
                },
                children: ['[file_name]'],
            },
        ],
    },
    {
        type: 'p',
        children: [
            'You can also ask me any follow-up questions that you have or adjust any part by generating a revised analysis.',
        ],
    },
    { type: 'br' },
    {
        type: 'img',
        events: {
            click: (event: MouseEvent) => {
                ;(event.target as HTMLElement).remove()
            },
        },
        attributes: {
            src: 'https://d1.awsstatic.com/logos/aws-logo-lockups/poweredbyaws/PB_AWS_logo_RGB_stacked_REV_SQ.91cd4af40773cbfbd15577a3c2b8a346fe3e8fa2.png',
            alt: 'Powered by AWS!',
        },
    },
]
