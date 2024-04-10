# AWS Toolkit API

Details about any publicly accessible functionalities exposed through [extension commands](https://code.visualstudio.com/api/references/vscode-api#commands) or [exported APIs](https://code.visualstudio.com/api/references/vscode-api#extensions).

# Extension API

The AWS Toolkit "extension API" is available and exposes a single `getApi()` interface which
requires a valid vscode extension-id that identifies the caller.

## Example usage

```typescript
const toolkitExt = vscode.extensions.getExtension('amazonwebservices.aws-toolkit-vscode')
const api = toolkitExt?.exports.getApi('my-extension-id')
if (api && 'listConnections' in api) {
    const connections: AwsConnection[] = await api?.listConnections()
    for (const conn of connections) {
        console.log('%O', conn)
    }
}
```

## listConnections()

**Signature**: _async () => Promise<AwsConnection>_

This is an API that exposes the metadata of SSO connections of AWS Toolkit. It returns a list of `AwsConnection` which contains below fields:

-   id: string that presents the id of the connection
-   label: label of the connection
-   type: type of the connection, currently only 'sso' is returned
-   ssoRegion: region of the connection, e.g: us-west-2
-   startUrl: start url of the connection
-   scopes?: list of the scopes of the connection

# Internal-only pseudo API

The following commands are available as a "pseudo API" for internal use.

## aws.codeWhisperer.connect

**Signature**: _async (source: string, startUrl?: string, region?: string, customizationArn?: string, customizationNamePrefix?: string) => Promise<void>_

Shortcut command to directly connect to Identity Center or prompt start URL entry, as well as set a customization for CodeWhisperer requests.

This command supports the following arguments:

-   source: An identifier of the caller of this command. This can be used for something like telemetry.
-   startUrl and region. If both arguments are provided they will be used, otherwise the command prompts for them interactively.
-   customizationArn: select customization by ARN. If provided, `customizationNamePrefix` is ignored.
-   customizationNamePrefix: select customization by prefix, if `customizationArn` is `undefined`.
