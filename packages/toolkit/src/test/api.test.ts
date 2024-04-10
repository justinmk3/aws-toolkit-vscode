/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'assert'
import { awsToolkitApi } from '../api'

describe('api', function () {
    describe('getApi()', function () {
        it('validates the given extension id', async function () {
            assert.throws(() => {
                awsToolkitApi.getApi('foo')
            })
        })
    })
})
