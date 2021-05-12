/*!
 * Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ServiceConfigurationOptions } from 'aws-sdk/lib/service'
import { ApiGatewayClient, DefaultApiGatewayClient } from './apiGatewayClient'
import { CloudFormationClient, DefaultCloudFormationClient } from './cloudFormationClient'
import { CloudWatchLogsClient, DefaultCloudWatchLogsClient } from './cloudWatchLogsClient'
import { DefaultEcrClient, EcrClient } from './ecrClient'
import { DefaultEcsClient, EcsClient } from './ecsClient'
import { DefaultIamClient, IamClient } from './iamClient'
import { DefaultLambdaClient, LambdaClient } from './lambdaClient'
import { DefaultSchemaClient, SchemaClient } from './schemaClient'
import { DefaultStepFunctionsClient, StepFunctionsClient } from './stepFunctionsClient'
import { DefaultStsClient, StsClient } from './stsClient'
import { DefaultSsmDocumentClient, SsmDocumentClient } from './ssmDocumentClient'
import { DefaultS3Client, S3Client } from './s3Client'
import { RegionProvider } from '../regions/regionProvider'
import { DEFAULT_PARTITION } from '../regions/regionUtilities'
import { ClassToInterfaceType } from '../utilities/tsUtils'
import { AppRunnerClient, DefaultAppRunnerClient } from './apprunnerClient'
import { getLogger } from '../logger/logger'

export type ToolkitClientBuilder = ClassToInterfaceType<DefaultToolkitClientBuilder>
export class DefaultToolkitClientBuilder {
    public constructor(private readonly regionProvider: RegionProvider) {}

    public createApiGatewayClient(regionCode: string): ApiGatewayClient {
        return new DefaultApiGatewayClient(regionCode)
    }

    public createCloudFormationClient(regionCode: string): CloudFormationClient {
        return new DefaultCloudFormationClient(regionCode)
    }

    public createCloudWatchLogsClient(regionCode: string): CloudWatchLogsClient {
        return new DefaultCloudWatchLogsClient(regionCode)
    }

    public createEcrClient(regionCode: string): EcrClient {
        return new DefaultEcrClient(regionCode)
    }

    public createEcsClient(regionCode: string): EcsClient {
        return new DefaultEcsClient(regionCode)
    }

    public createIamClient(regionCode: string): IamClient {
        return new DefaultIamClient(regionCode)
    }

    public createLambdaClient(regionCode: string): LambdaClient {
        return new DefaultLambdaClient(regionCode)
    }

    public createSchemaClient(regionCode: string): SchemaClient {
        return new DefaultSchemaClient(regionCode)
    }

    public createStepFunctionsClient(regionCode: string): StepFunctionsClient {
        return new DefaultStepFunctionsClient(regionCode)
    }

    public createStsClient(regionCode: string, credentials?: ServiceConfigurationOptions): StsClient {
        return new DefaultStsClient(regionCode, credentials)
    }

    public createS3Client(regionCode: string): S3Client {
        return new DefaultS3Client(this.regionProvider.getPartitionId(regionCode) ?? DEFAULT_PARTITION, regionCode)
    }

    public createSsmClient(regionCode: string): SsmDocumentClient {
        return new DefaultSsmDocumentClient(regionCode)
    }

    public createAppRunnerClient(regionCode: string): AppRunnerClient {
        return new DefaultAppRunnerClient(regionCode)
    }
}

/**
 * Formats `AWS.AWSError` for logging or text display.
 *
 * @param e `AWS.AWSError` object
 * @param path HTTP path or API name that characterizes the request, if any.
 * @param stack Decides whether to include the stacktrace.
 * @returns Formatted error string.
 */
export function fmtAwsError(e: AWS.AWSError, path?: string, stack = false): string {
    const logDebug = getLogger().logLevelEnabled('debug')
    let formatted = `AWS request failed: ${e.statusCode}: ${e.code}: ${path}`
    // Format AWS.AWSError fields, if any.
    for (const name of ['message', 'name', 'region', 'requestId', 'cfId', 'extendedRequestId', 'hostname']) {
        if ((e as any)[name]) {
            formatted += `\n  ${name}: ${(e as any)[name]}`
        }
    }
    if (logDebug && stack) {
        formatted += `\n  stack: ${e.stack}`
    }
    if (logDebug) {
        formatted += `\n  originalError: ${e.originalError}`
    }
    return formatted
}
