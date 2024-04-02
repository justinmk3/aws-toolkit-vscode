/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from 'vscode'
import * as path from 'path'
import { getGlobDirExcludedPatterns } from '../../shared/fs/watchedFiles'
import { getWorkspaceRelativePath } from '../../shared/utilities/workspaceUtils'
import AdmZip from 'adm-zip'
import { getLogger } from '../../shared/logger/logger'
import { maxFileSizeBytes } from '../limits'
import fs from 'fs-extra'
import { GitIgnoreFilter } from './gitignore'
import { Uri } from 'vscode'

export function getExcludePattern(additionalPatterns: string[] = []) {
    const globAlwaysExcludedDirs = getGlobDirExcludedPatterns().map(pattern => `**/${pattern}/*`)

    const excludedExtensions = ['zip', 'bin', 'png', 'jpg', 'svg', 'ico', 'gif', 'jfif', 'pyc', 'md', 'sql']

    const extraPatterns = [
        '**/package-lock.json',
        '**/yarn.lock',
        '**/.gitignore',
        '**/.gitattributes',
        '**/.esprintrc',
        '**/.eslintignore',
        '**/.prettierrc',
        '**/.npmrc',
        '**/.eslintrc.*',
        '**/*babel.config.*',
        '**/.env*',
        '**/license.txt',
        '**/License.txt',
        '**/LICENSE.txt',
        '**/LICENSE',
        ...excludedExtensions.map(ext => `**/*.${ext}`),
    ]
    const allPatterns = [...globAlwaysExcludedDirs, ...extraPatterns, ...additionalPatterns]
    return `{${allPatterns.join(',')}}`
}

export function getWorkspaceRootDir() {
    const workspaceFolders = vscode.workspace.workspaceFolders
    if (workspaceFolders === undefined || workspaceFolders.length === 0) {
        throw new Error('No workspace was found')
    }

    return workspaceFolders[0].uri.fsPath
}

/**
 * @param rootPath root folder to look for .gitignore files
 * @returns list of glob patterns extracted from .gitignore
 * These patterns are compatible with vscode exclude patterns
 */
async function filterOutGitignoredFiles(rootPath: string, files: Uri[]): Promise<Uri[]> {
    const gitIgnoreFiles = await vscode.workspace.findFiles(new vscode.RelativePattern(rootPath, '**/.gitignore'))

    const gitIgnoreFilter = await GitIgnoreFilter.build(gitIgnoreFiles)
    return gitIgnoreFilter.filterFiles(files)
}

/**
 * given the root path of the repo it zips its files in memory
 */
export async function prepareRepoData(repoRootPath: string) {
    try {
        const zip = new AdmZip()

        const allFiles = await vscode.workspace.findFiles(
            new vscode.RelativePattern(repoRootPath, '**'),
            getExcludePattern()
        )

        const files = await filterOutGitignoredFiles(repoRootPath, allFiles)

        await Promise.allSettled(
            files.map(async file => {
                const isValid = await shouldAddFile(file)
                if (isValid) {
                    return addFile(file, zip)
                }
            })
        )

        const zipFileBuffer = zip.toBuffer()
        return { zipFileBuffer }
    } catch (error) {
        throw new Error(`refactorAssistant: Failed to prepare repo: ${error}`)
    }
}

async function shouldAddFile(file: vscode.Uri): Promise<boolean> {
    const fileSize = (await vscode.workspace.fs.stat(vscode.Uri.file(file.fsPath))).size
    return fileSize <= maxFileSizeBytes
}

async function addFile(file: vscode.Uri, zip: AdmZip) {
    const relativePath = getWorkspaceRelativePath(file.fsPath)
    const zipFolderPath = relativePath ? path.dirname(relativePath.relativePath) : ''
    try {
        zip.addLocalFile(file.fsPath, zipFolderPath)
    } catch (error) {
        getLogger().debug(
            `refactorAssistant: Failed to read file ${file.fsPath} when collecting repository: ${error}. Skipping the file`
        )
    }
}

export async function writeFile(path: string, contents: string) {
    fs.outputFileSync(path, Buffer.from(contents))
}
