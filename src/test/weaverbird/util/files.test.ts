/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import vscode from 'vscode'
import * as path from 'path'
import sinon from 'sinon'
import assert from 'assert'
import { collectFiles, prepareRepoData } from '../../../weaverbird/util/files'
import { createTestWorkspace, toFile } from '../../testUtil'

describe('file utils', () => {
    describe('collectFiles', function () {
        it('returns all files in the workspace', async function () {
            // these variables are a manual selection of settings for the test in order to test the collectFiles function
            const fileAmount = 2
            const fileNamePrefix = 'file'
            const fileContent = 'test content'

            const workspace = await createTestWorkspace(fileAmount, { fileNamePrefix, fileContent })
            sinon.stub(vscode.workspace, 'workspaceFolders').value([workspace])

            const result = await collectFiles(workspace.uri.fsPath, false)
            assert.strictEqual(result.length, fileAmount)
            for (let i = 0; i < fileAmount; i++) {
                assert.strictEqual(result[i].filePath.includes(fileNamePrefix), true)
                assert.strictEqual(result[i].fileContent, fileContent)
            }
        })
    })

    describe('prepareRepoData', function () {
        it('returns files in the workspace as a zip', async function () {
            // these variables are a manual selection of settings for the test in order to test the collectFiles function
            const fileAmount = 2
            const fileNamePrefix = 'file'
            const fileContent = 'test content'
            const conversationId = 'fake-conversation-id'

            const workspace = await createTestWorkspace(fileAmount, { fileNamePrefix, fileContent })

            const result = await prepareRepoData(workspace.uri.fsPath, conversationId)
            assert.strictEqual(Buffer.isBuffer(result.zipFileBuffer), true)
            // checksum is not the same across different test executions because some unique random folder names are generated
            assert.strictEqual(result.zipFileChecksum.length, 64)
        })
    })

    it('returns all files in the workspace not excluded by gitignore', async function () {
        // these variables are a manual selection of settings for the test in order to test the collectFiles function
        const fileAmount = 3
        const fileNamePrefix = 'file'
        const fileContent = 'test content'

        const workspace = await createTestWorkspace(fileAmount, { fileNamePrefix, fileContent })

        const writeFile = (pathParts: string[], fileContent: string) => {
            toFile(fileContent, workspace.uri.fsPath, ...pathParts)
        }

        sinon.stub(vscode.workspace, 'workspaceFolders').value([workspace])
        const gitignoreContent = `file2
        # different formats of prefixes
        /build
        node_modules

        #some comment

        range_file[0-5]
        `
        writeFile(['.gitignore'], gitignoreContent)

        writeFile(['build', `ignored1`], fileContent)
        writeFile(['build', `ignored2`], fileContent)

        writeFile(['node_modules', `ignored1`], fileContent)
        writeFile(['node_modules', `ignored2`], fileContent)

        writeFile([`range_file0`], fileContent)
        writeFile([`range_file9`], fileContent)

        const gitignore2 = 'folder1\n'
        writeFile(['src', '.gitignore'], gitignore2)
        writeFile(['src', 'folder2', 'a.js'], fileContent)

        const gitignore3 = `negate_test*
        !negate_test[0-5]`
        writeFile(['src', 'folder3', '.gitignore'], gitignore3)
        writeFile(['src', 'folder3', 'negate_test1'], fileContent)
        writeFile(['src', 'folder3', 'negate_test6'], fileContent)

        const result = await collectFiles(workspace.uri.fsPath, true)
        result.sort((l, r) => l.filePath.localeCompare(r.filePath))

        // non-posix filePath check here is important.
        assert.deepStrictEqual(
            [
                {
                    filePath: '.gitignore',
                    fileContent: gitignoreContent,
                },
                {
                    filePath: 'file1',
                    fileContent: 'test content',
                },
                {
                    filePath: 'file3',
                    fileContent: 'test content',
                },
                {
                    filePath: 'range_file9',
                    fileContent: 'test content',
                },
                {
                    filePath: path.join('src', '.gitignore'),
                    fileContent: gitignore2,
                },
                {
                    filePath: path.join('src', 'folder2', 'a.js'),
                    fileContent: fileContent,
                },
                {
                    filePath: path.join('src', 'folder3', '.gitignore'),
                    fileContent: gitignore3,
                },
                {
                    filePath: path.join('src', 'folder3', 'negate_test1'),
                    fileContent: fileContent,
                },
            ],
            result
        )
    })
})