/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { EditorContextCommand, EditorContextCommandType } from '../../../commands/registerCommands'

// TODO: It's a workaround for the demo, we need to remove it after backend will be ready

export class PromptsGenerator {
    private editorContextMenuCommandVerbs: Map<EditorContextCommandType, string> = new Map([
        ['aws.awsq.explainCode', 'Explain'],
        ['aws.awsq.refactorCode', 'Refactor'],
        ['aws.awsq.fixCode', 'Fix'],
        ['aws.awsq.optimizeCode', 'Optimize'],
        ['aws.awsq.sendToPrompt', 'Send to prompt'],
    ])

    public generateForContextMenuCommand(command: EditorContextCommand): string {
        return [this.editorContextMenuCommandVerbs.get(command.type), ' the selected codeblock'].join('')
    }
}