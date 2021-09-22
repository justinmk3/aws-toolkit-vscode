/*!
 * Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { ECS } from 'aws-sdk'
import { EcsClient } from '../../shared/clients/ecsClient'
import { AWSResourceNode } from '../../shared/treeview/nodes/awsResourceNode'
import { AWSTreeNodeBase } from '../../shared/treeview/nodes/awsTreeNodeBase'
import { ErrorNode } from '../../shared/treeview/nodes/errorNode'
import { PlaceholderNode } from '../../shared/treeview/nodes/placeholderNode'
import { makeChildrenNodes } from '../../shared/treeview/treeNodeUtilities'
import { localize } from '../../shared/utilities/vsCodeUtils'
import { EcsClusterNode } from './ecsClusterNode'
import { EcsContainerNode } from './ecsContainerNode'
import { toArrayAsync, toMap } from '../../shared/utilities/collectionUtils'
import { CloudWatchLogsBase } from '../../cloudWatchLogs/explorer/cloudWatchLogsNode'
import { CloudWatchLogs } from 'aws-sdk'
import { CloudWatchLogsClient } from '../../shared/clients/cloudWatchLogsClient'

export class EcsServiceNode extends CloudWatchLogsBase implements AWSResourceNode {
    public constructor(
        public readonly service: ECS.Service,
        public readonly parent: EcsClusterNode,
        public readonly ecs: EcsClient
    ) {
        super(service.serviceName ?? '?', ecs.regionCode, localize('AWS.explorerNode.nologs', '[No logs found]'))
        this.tooltip = `${service.serviceArn}\nTask Definition: ${service.taskDefinition}`
        this.contextValue = 'awsEcsServiceNode'
    }

    public async getChildren(): Promise<AWSTreeNodeBase[]> {
        return await makeChildrenNodes({
            getChildNodes: async () => {
                const containerNames = await this.ecs.listContainerNames(this.service.taskDefinition!)
                return containerNames.map(name => new EcsContainerNode(name, this.name, this.parent.arn, this.ecs))
            },
            getErrorNode: async (error: Error, logID: number) => new ErrorNode(this, error, logID),
            getNoChildrenPlaceholderNode: async () =>
                new PlaceholderNode(this, localize('AWS.explorerNode.ecs.noContainers', '[No Containers found]')),
        })
    }

    public get arn(): string {
        if (this.service.serviceArn === undefined) {
            throw Error()
        }
        return this.service.serviceArn
    }

    public get name(): string {
        if (this.service.serviceName === undefined) {
            throw Error()
        }
        return this.service.serviceName
    }

    protected async getLogGroups(client: CloudWatchLogsClient): Promise<Map<string, CloudWatchLogs.LogGroup>> {
        return toMap(
            await toArrayAsync(
                client.describeLogGroups({
                    logGroupNamePrefix: `/aws/ecs/${this.name}`, // + `/${this._info.ServiceId}`
                })
            ),
            configuration => configuration.logGroupName
        )
    }
}
