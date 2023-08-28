/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from 'vscode'
import { getLogger } from './shared/logger/logger'
import { activate as activateLogger } from './shared/logger/activation'
import { initialize } from './shared/extensionGlobals'
import { getIdeProperties } from './shared/extensionUtilities'

// The following is required so that the copyFiles script does not fail.
// I'm assuming this generates something when run that the script can use.
// import * as nls from 'vscode-nls'
// nls.loadMessageBundle()

export async function activate(context: vscode.ExtensionContext) {
    vscode.window.showInformationMessage(
        'AWS Toolkit: Browser Mode Under Development. No features are currently provided',
        { modal: true }
    )

    getLogger().info('yay')

    // await initializeComputeRegion()
    // const activationStartedOn = Date.now()
    // localize = nls.loadMessageBundle()
    initialize(context)
    // initializeManifestPaths(context)

    const toolkitOutputChannel = vscode.window.createOutputChannel(`${getIdeProperties().company} Toolkit`)
    await activateLogger(context, toolkitOutputChannel)
}

export async function deactivate() {}
