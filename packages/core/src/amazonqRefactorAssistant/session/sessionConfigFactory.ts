/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { VirtualFileSystem } from '../../shared/virtualFilesystem'

export interface SessionConfig {
    readonly fs: VirtualFileSystem
}

/**
 * Factory method for creating session configurations
 * @returns An instantiated SessionConfig
 */
export async function createSessionConfig(): Promise<SessionConfig> {
    const fs = new VirtualFileSystem()

    return Promise.resolve({ fs })
}
