/*!
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as assert from 'assert'
import * as textUtil from '../../../shared/utilities/textUtilities'
import * as aws from 'aws-sdk'
import { createFakeAwsService } from '../../testUtil'

describe('removeAnsi()', async function () {
    it('removes ansi code from text', async function () {
        assert.strictEqual(textUtil.removeAnsi('\u001b[31mHello World'), 'Hello World')
    })

    it('text without ansi code remains as-is', async function () {
        const text = 'Hello World 123!'
        assert.strictEqual(textUtil.removeAnsi(text), text)
    })
})

describe('getStringHash()', async function () {
    it('produces a hash', async function () {
        assert.ok(textUtil.getStringHash('hello'))
    })

    it('produces a different hash for different strings', async function () {
        assert.notStrictEqual(textUtil.getStringHash('hello'), textUtil.getStringHash('hello '))
    })
})

describe('textUtil', async function () {
    it('top()', async function () {
        assert.deepStrictEqual(textUtil.top(2, 'line1\nline2\nline3line4'), 'line1\nline2\n')
        assert.deepStrictEqual(textUtil.top(9000, 'line1\nline2\nline3line4'), 'line1\nline2\nline3line4')
        assert.deepStrictEqual(textUtil.top(9000, 'line1'), 'line1')
        assert.deepStrictEqual(textUtil.top(9000, 'line1\n\n\n'), 'line1\n\n\n')
        assert.deepStrictEqual(textUtil.top(0, 'line1\nline2\n'), '')
        assert.deepStrictEqual(textUtil.top(1, 'line1\nline2\n'), 'line1\n')
        assert.deepStrictEqual(textUtil.top(2, 'line1\nline2\n'), 'line1\nline2\n')
    })

    it('getAwsServiceFromStacktrace()', async function () {
        const testInput = `1993-05-12 16:58:30 [ERROR]: Failed to list buckets: [InvalidAccessKeyId: The AWS Access Key Id you provided does not exist in our records.
            at Request.extractError (/Volumes/workplace/aws-toolkit-vscode/node_modules/aws-sdk/lib/services/s3.js:718:35)
            at Request.callListeners (/Volumes/workplace/aws-toolkit-vscode/node_modules/aws-sdk/lib/sequential_executor.js:106:20)
            at Request.emit (/Volumes/workplace/aws-toolkit-vscode/node_modules/aws-sdk/lib/request.js:688:14)
            at Request.transition (/Volumes/workplace/aws-toolkit-vscode/node_modules/aws-sdk/lib/request.js:22:10)
            at AcceptorStateMachine.runTo (/Volumes/workplace/aws-toolkit-vscode/node_modules/aws-sdk/lib/state_machine.js:14:12)
            at Request.<anonymous> (/Volumes/workplace/aws-toolkit-vscode/node_modules/aws-sdk/lib/request.js:38:9)
            at Request.callListeners (/Volumes/workplace/aws-toolkit-vscode/node_modules/aws-sdk/lib/sequential_executor.js:116:18)
            at Request.emit (/Volumes/workplace/aws-toolkit-vscode/node_modules/aws-sdk/lib/sequential_executor.js:78:10)
            at Request.emit (/Volumes/workplace/aws-toolkit-vscode/node_modules/aws-sdk/lib/request.js:688:14)
            at Request.transition (/Volumes/workplace/aws-toolkit-vscode/node_modules/aws-sdk/lib/request.js:22:10)
            at IncomingMessage.emit (domain.js:467:12)
            at endReadableNT (internal/streams/readable.js:1327:12)
            at processTicksAndRejections (internal/process/task_queues.js:80:21)] {`

        assert.deepStrictEqual(textUtil.getAwsServiceFromStacktrace(testInput), 'aws-sdk/lib/services/s3')

        try {
            // Simulate a failed AWS S3 request.
            await createFakeAwsService(aws.S3).listBuckets().promise()
            assert.fail('expected failure')
        } catch (e) {
            assert.deepStrictEqual(textUtil.getAwsServiceFromStacktrace(e.stack), 'aws-sdk/lib/services/s3')
        }

        try {
            // Simulate a failed AWS APIGW request.
            await createFakeAwsService(aws.APIGateway).getDeployments({ restApiId: 'fakeApi' }).promise()
            assert.fail('expected failure')
        } catch (e) {
            assert.deepStrictEqual(textUtil.getAwsServiceFromStacktrace(e.stack), 'aws-sdk/lib/protocol/json')
        }
    })
})
