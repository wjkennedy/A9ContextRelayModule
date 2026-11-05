# @a9group/context-relay

The browser client for Context Relay. It sends a user's report to the host application's same-origin assertion endpoint, then relays the signed envelope and exact report body to the receiver chosen by that host (Forge, the host’s Jira integration, or a third-party receiver).

The client does not know service ownership, sign envelopes, or hold Jira credentials.

## Install

```sh
npm install @a9group/context-relay
```

## Use

```js
import { createContextRelay } from '@a9group/context-relay';

const relay = createContextRelay({
  assertionUrl: 'https://signer.example.com/api/context-assertion',
  receiverUrl: 'https://host-selected-receiver.example/intake',
  evidenceCollector
});

const receipt = await relay.submit({
  report: { message: 'My delivery date disappeared.' },
  surface: 'shipping',
  onStatus: ({ stage }) => console.log(stage)
});
```

## Session evidence and mobile shake

Use the optional local collector to retain host-selected, observable session facts until the customer explicitly reports a problem. Its snapshot is included in the report and therefore bound by the host assertion. The collector never reads cookies, storage, request headers, form values, or the DOM.

```js
import { createSessionEvidenceCollector } from '@a9group/context-relay';

const evidenceCollector = createSessionEvidenceCollector();
evidenceCollector.record('lot.opened', { lotId: '047', bidCount: 18 });

// Call from a user gesture on iOS, where motion permission is required.
await evidenceCollector.enableShake({
  onShake: () => openNeedHelpConfirmation()
});
```

## Release and npm publishing

Publishing is handled by [`.github/workflows/publish-npm.yml`](.github/workflows/publish-npm.yml). Create a GitHub Release from a `v<package-version>` tag; the workflow checks the version, runs the test suite, previews the package contents, and uses npm trusted publishing to publish with provenance.

Before the first release, configure npm’s Trusted Publisher for `@a9group/context-relay` with GitHub owner `wjkennedy`, repository `A9ContextRelayModule`, and workflow file `publish-npm.yml`. No npm access token is stored in GitHub.

## Integration contract

- Assertion endpoint: accepts `{ report: { message }, surface }`, returns `{ envelope }`.
- Receiver: accepts `{ report, envelope }`, verifies the host envelope, and returns a Context Relay receipt.
- Both URLs must permit the host origin through CORS.

## License

Apache-2.0
