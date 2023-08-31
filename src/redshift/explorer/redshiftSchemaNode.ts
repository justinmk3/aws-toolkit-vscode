/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import * as vscode from 'vscode'
import { AWSTreeNodeBase } from '../../shared/treeview/nodes/awsTreeNodeBase'
import { DefaultRedshiftClient } from '../../shared/clients/redshiftClient'
import { makeChildrenNodes } from '../../shared/treeview/utils'
import { PlaceholderNode } from '../../shared/treeview/nodes/placeholderNode'
import { localize } from '../../shared/utilities/vsCodeUtils'
import { RedshiftTableNode } from './redshiftTableNode'
import { ConnectionParams } from '../models/models'
import { ChildNodeLoader, ChildNodePage } from '../../awsexplorer/childNodeLoader'
import { LoadMoreNode } from '../../shared/treeview/nodes/loadMoreNode'
import { getLogger } from '../../shared/logger'
import { telemetry } from '../../shared/telemetry/telemetry'

export class RedshiftSchemaNode extends AWSTreeNodeBase implements LoadMoreNode {
    private readonly childLoader = new ChildNodeLoader(this, token => this.loadPage(token))
    private readonly logger = getLogger()
    public constructor(
        public readonly schemaName: string,
        public readonly redshiftClient: DefaultRedshiftClient,
        private readonly connectionParams: ConnectionParams
    ) {
        super(schemaName, vscode.TreeItemCollapsibleState.Collapsed)
        this.contextValue = 'awsRedshiftSchemaNode'
    }

    public async loadMoreChildren(): Promise<void> {
        await this.childLoader.loadMoreChildren()
    }

    public isLoadingMoreChildren(): boolean {
        return this.childLoader.isLoadingMoreChildren()
    }

    public clearChildren(): void {
        this.childLoader.clearChildren()
    }

    private async loadPage(token?: string): Promise<ChildNodePage<RedshiftTableNode>> {
        const newChildren: RedshiftTableNode[] = []
        try {
            const listTablesResponse = await this.redshiftClient.listTables(
                this.connectionParams,
                this.schemaName,
                token
            )
            if (listTablesResponse.Tables) {
                newChildren.push(
                    ...listTablesResponse.Tables.filter(table => !table.name?.endsWith('_pkey')).map(table => {
                        return new RedshiftTableNode(table.name ?? 'UnknownTable')
                    })
                )
            }
            return {
                newChildren: newChildren,
                newContinuationToken: listTablesResponse.NextToken,
            }
        } catch (error) {
            this.logger.error(`Failed to fetch tables for ${this.schemaName}: ${error}`)
            vscode.window.showErrorMessage(`Failed to fetch tables for ${this.schemaName}: ${error}`)
            return Promise.reject(error)
        } finally {
            telemetry.redshift_listingAPI.emit()
        }
    }

    public override async getChildren(): Promise<AWSTreeNodeBase[]> {
        return await makeChildrenNodes({
            getChildNodes: async () => this.childLoader.getChildren(),
            getNoChildrenPlaceholderNode: async () =>
                new PlaceholderNode(this, localize('AWS.explorerNode.redshiftClient.noTables', 'No tables found')),
        })
    }
}
