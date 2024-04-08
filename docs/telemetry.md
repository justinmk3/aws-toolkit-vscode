# Telemetry

## Development

See [aws-toolkit-common/telemetry](https://github.com/aws/aws-toolkit-common/tree/main/telemetry#telemetry) for full details about defining telemetry metrics.

-   You can define new metrics during development by adding items to
    [telemetry/vscodeTelemetry.json](https://github.com/aws/aws-toolkit-vscode/blob/21ca0fca26d677f105caef81de2638b2e4796804/src/shared/telemetry/vscodeTelemetry.json).
    -   The `generateClients` build task generates new symbols in `shared/telemetry/telemetry`, which you can import via:
        ```
        import { telemetry } from '/shared/telemetry/telemetry'
        ```
    -   When your feature is released, the "development" metrics you defined in `vscodeTelemetry.json` should be upstreamed to [aws-toolkit-common](https://github.com/aws/aws-toolkit-common/blob/main/telemetry/definitions/commonDefinitions.json).
-   Metrics are dropped (not posted to the service) if the extension is running in [CI or other
    automation tasks](https://github.com/aws/aws-toolkit-vscode/blob/21ca0fca26d677f105caef81de2638b2e4796804/src/shared/vscode/env.ts#L71-L73).
    -   You can always _test_ telemetry via [assertTelemetry()](https://github.com/aws/aws-toolkit-vscode/blob/21ca0fca26d677f105caef81de2638b2e4796804/src/test/testUtil.ts#L164), regardless of the current environment.

## Designing metrics

Consider the following central ideas, before defining a new metric.

-   Standard fields. These fields are implicitly available on all merics. Do not add redundant fields ("types") that serve the same purpose as these fields.
    -   `duration`
    -   `unit`
    -   `reason`
    -   `result`

wrap things in run()

the notion of "canceled" is stored in any metric by default, if you wrap your code (at any layer) in run() and then anywhere in that context you can [throw Cancel](https://github.com/aws/aws-toolkit-vscode/blob/06661f84530c6b5331579871d685515700b7767e/src/auth/sso/model.ts#L138).

the telemetry client automatically takes care of this. having separate metrics for "cancel", "time", etc, is (1) redundant and (2) misses out on failures. any exception thrown during `run()` is captured as `result=failed`.

The general idea is that fields and metrics should be generalized where possible. Sometimes specificity is needed, and that's fine. But often it's not. An obvious example is `sessionId: string`, there's no reason to define `fooSessionId`, `barSessionId`, etc. They are all the same concept.

Same with `foo_verySpecificThingWasClicked`. Storing "click" in the metric name means we can't use it for other kinds of interactions, and that is just not useful (and makes telemetry dashboards harder to maintain).

### Example

            await telemetry.refactorAssistant_generateRecommendation.run(async telemetrySpan => {
                telemetrySpan.record({
                    refactorAssistantSessionId: this.config.sessionId,
                    refactorAssistantRecommendationId: this.config.assessmentId,
                    refactorAssistRecommendationStartTime: Math.floor(performance.now()),
                })
                nextState = await this.handlePlanExecution(action, this.tabID, this.config, progressMessageId)
                return nextState
            })

The time taken by this `run()` context (which currently is only executing `handlePlanExecution()`) will be captured by `run()` in the `duration` field, by default.
The "start time" is captured in the metric timestamp (another default field).

### Example

Consider the following example:

        {
            "name": "refactorAssistant_planGenerationIsCanceledFromChatPrompt",
            "passive": true,
            "description": "Metric for cancellation of plan generation",
            "metadata": [
                {
                    "type": "sessionId",
                    "required": true
                },
                {
                    "type": "reportId"
                }
            ]
        }

This metric is extremely hyper-specific. Do we need an entire metric dedicated to "plan generation canceled in a very specific situation"?

-   is this different than if `result=Canceled` is set on the `refactorAssistant_generateRecommendation` metric? why?
-   should there be a `refactorAssistant_generatePlan` metric, which could then set a `result` field (automatically done by `run()`)
-   you can store "chat" or "chatPrompt" in a `source` field. That avoids the hyper-specificity of `FromChatPrompt` in the metric name.

## Guidelines

-   **Use run() where possible, to wrap as much "scope" as possible.** It automatically sets the `result`, `reason`, and `duration` fields. See below for details.
    -   `run()` gets the `reason` value from the `Error.code` property of any exception that is thrown. The `result` and `reason` fields alert us to error spikes and potential bugs.
    -   `duration` reflects the running time of the wrapped code. **This helps alert us to performance regressions.**
    -   Your code can throw `ToolkitError` with a `code` field to communicate errors, validation issues, or [cancellation](https://github.com/aws/aws-toolkit-vscode/blob/06661f84530c6b5331579871d685515700b7767e/src/auth/sso/model.ts#L138). See below.
        They should be used instead of special-purpose metrics or fields.
-   `result` allows the Toolkits team to monitor all features for potential regressions.
-   `reason` gives insight into the cause of a `result=Failed` metric.
-   `telemetry.record()` called during a `telemetry.foo.run(…)` context will automatically annotate the current `foo` metric.
    -   For example, the cloudwatch logs feature adds `hasTimeFilter` info its metrics by [calling telemetry.record()](https://github.com/aws/aws-toolkit-vscode/blob/06661f84530c6b5331579871d685515700b7767e/src/cloudWatchLogs/cloudWatchLogsUtils.ts#L21-L24).
    -   **Notice** how `telemetry.record()` does not reference a particular `span`. It automatically annotates [the current span and any "future" spans](https://github.com/aws/aws-toolkit-vscode/blob/663fe5de47bcaed1d8cb8b924370880330a4e06e/packages/core/src/shared/telemetry/spans.ts#L228-L241) in the current run() context.

## Incrementally Building a Metric

User actions or other features may have multiple stages/steps, called a "workflow" or just "flow". A telemetry ["trace"](https://opentelemetry.io/docs/concepts/signals/traces/) captures a flow as tree of ["spans"](https://opentelemetry.io/docs/concepts/signals/traces/#spans).

For example, `setupThing()` has multiple steps until it is completed, ending with `lastSetupStep()`.

```typescript
function setupThing() {
    setupStep1()
    setupStep2()
    ...
    lastSetupStep()
}
```

<br>

If we want to send a metric event, lets call it `metric_setupThing`, then the code could look something like this:

```typescript
function setupThing() {
    try {
        ...
        lastSetupStep()
        telemetry.metric_setupThing.emit({result: 'Succeeded', ...})
    }
    catch (e) {
        telemetry.metric_setupThing.emit({result: 'Failed', reason: 'Not Really Sure Why' ...})
    }
}
```

Here we emitted a final metric based on the failure or success of the entire execution. Each metric is discrete and immediately gets sent to the telemetry service.

<br>

But usually code is not flat and there are many nested calls. If something goes wrong during the execution it would be useful to have more specific information at the area of failure. For that we can use `run()` along with `telemetry.record()`.

`run()` accepts a callback, and when the callback is executed, any uses of `telemetry.record()` at _any nesting level_ during execution of that callback, will update the
attributes of the ["current metric"](https://github.com/aws/aws-toolkit-vscode/blob/13cb98d5315092ddc9eb5ba898e5f26810dada25/src/shared/telemetry/spans.ts#L233).
And at the end (that is, when `run()` returns) we will emit a single metric with the last updated attributes.
[Example](https://github.com/aws/aws-toolkit-vscode/blob/06661f84530c6b5331579871d685515700b7767e/src/cloudWatchLogs/cloudWatchLogsUtils.ts#L21-L24)

When an exception is thrown from a `run()` context, `run()` will [automatically set](https://github.com/aws/aws-toolkit-vscode/blob/a583825bec6cb68c4942fa60d185644833528532/src/shared/errors.ts#L273-L289)
the `reason` field based on the Error `code` field. You can explicitly set `code` when throwing
a `ToolkitError`, for [example](https://github.com/aws/aws-toolkit-vscode/blob/d08e59952a6c75a5c6c00fdc464e26750c0e85f5/src/auth/auth.ts#L530):

    throw new ToolkitError('No sso-session name found in ~/.aws/config', { code: 'NoSsoSessionName' })

Note: prefer reason codes with a format similar to existing codes (not sentences). You can find existing codes by searching the codebase:

    git grep 'code: '

### Example

```typescript
setupThing()

function setupThing() {
    // Start the run() for metric_setupThing
    telemetry.metric_setupThing.run(span => {
        // Update the metric with initial attributes
        span.record({sessionId: '123456'}) // now no matter where the control flow exits after this line in this method, this attribute will always be set
        ...
        setupStep2()
        ...

        if (userInput.CancelSelected) {
            // By setting the `cancelled` attribute to true, the `result` attribute will be set to Cancelled
            throw new ToolkitError("Thing has been cancelled", { cancelled: true})
        }
    })
    // At this point the final values from the `record()` calls are used to emit a the final metric.
    // If no exceptions have been thrown, the `result` attribute is automatically set to Success.
}

function setupStep2() {
    try {
        // Do work
    }
    catch (e) {
        // Here we can update the metric with more specific information regarding the failure.

        // Also notice we are able to use `telemetry.metric_setupThing` versus `span`.
        // This is due to `metric_setupThing` being added to the "context" from the above run()
        // callback argument. So when we use record() below it will update the same
        // thing that span.record() does.

        // Keep in mind record() must be run inside the callback argument of run() for
        // the attributes of that specific metric to be updated.
        telemetry.metric_setupThing.record({
            workDone: // ...
        })
        // If this exception is allowed to propogate to the `run()`, then the `result` will be automatically set to Failed and the `reason` to the `code` set here
        throw new ToolkitError(e as Error, { code: "SomethingWentWrongInStep2"})
    }
}
```

<br>

Finally, if `setupStep2()` was the thing that failed we would see a metric like:

```
{
    "metadata.metricName": "metric_setupThing",
    "sessionId": "123456",
    "result": "Failed",
    "reason": "SomethingWentWrongInStep2",
    ...
}
```
