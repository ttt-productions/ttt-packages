# @ttt-productions/file-input

Generic file, image, video, and audio input package.

## Owns

- Media input components
- File pickers, camera capture, and crop UI
- Client-side file validation helpers such as `validateAndNormalizeUploadFile`
- Input behavior driven by neutral `MediaOriginSpec`

## Boundary

The package consumes generic media shapes from `media-schemas`; it does not know any app's origin enum or media registry. The consuming app passes concrete specs from its own registry at its boundary.

`MediaInput` and the recording preview render through `@ttt-productions/media-viewer` (`MediaPreview`) — the package's one same-tier dependency, so picked and recorded files use the same canonical viewer. Selected-file UI uses semantic labels such as `Audio selected`; original filenames remain upload metadata and are never displayed by this package.

`MediaInput` exposes an additive imperative handle (`MediaInputHandle`) via `ref`: `openSelection()` activates the SAME trigger semantics as a human click — one enabled action runs directly through the canonical selection path (honoring `onBeforeSelect`, validation, and crop), multiple actions open the choice dropdown — and no-ops while `disabled`/`isLoading`. It never touches the hidden input directly, so none of the trigger gates are bypassed. Consumers use it to re-open the picker from an external control (e.g. an "Attach again" action).

The crop is the image's first lossy encode, so `MediaInput` encodes it at the `format` and `quality` its crop spec (`imageCrop`, or `cropOverride`) declares; an undeclared format is JPEG and an undeclared quality is 80.

## Inside a consumer's form

The pickers are rendered inside consumers' forms (e.g. a deferred-upload form shell), and ui-core's
`Button` passes no `type`, so every `Button` a file-input component renders states `type="button"` (or
renders through `asChild`): choosing a file, opening Info, clearing the choice, or cancelling an upload
never submits the surrounding form. `__tests__/button-type-guard.test.ts` fails on an untyped one. The
icon-only clear button is named by `clearLabel` (default "Clear selected file", like the package's
other built-in labels, which a consumer may replace), and the record dialog's Video/Audio toggles
announce the selected kind with `aria-pressed`. No
secondary control carries a red hover or a red variant — red belongs only to a dialog's confirm
action (destructive red belongs only to a confirmation dialog); the dialogs' Close/Cancel buttons are `outline`.

## In-progress feedback

Every async step shows pending for its whole window and ignores a repeat, so no double click can emit — and upload — twice:

- The trigger is `pending` while a picked, captured, or recorded file is validated (type, meta, duration, dimensions, crop), and the hidden picker cannot reopen meanwhile.
- Crop Confirm, Capture, Flip, and record Start/Save run through `useAsyncAction`; their dialogs cannot be dismissed mid-step.
- Camera/microphone acquisition shows a labeled spinner over the preview, and the kind toggles stay disabled while it runs. The record dialog's Start is enabled only once its stream is ready, or once acquisition failed with its error showing, so a retry stays possible — never before acquisition begins.
- **Late devices are stopped.** A camera or microphone that finishes starting after a teardown is stopped, never attached — in the photo dialog (close, unmount, a newer acquisition such as Flip) and the record dialog (close, kind switch, re-record) alike.
- The upload percent bar judges the size of the file the input emitted, so it works when the consumer passes `selectedFile={null}` after hand-off.

## Client claim + neutral pass-through

`MediaInputChangePayload.claim` carries the action-derived `ClientMediaClaim` (picker →
advisory inference; camera/recorder → strong, from the dialog's own recorded kind — never the
blob MIME; crop preserves the original claim). Unknown picker metadata is no longer fabricated
into `image/jpeg`: it passes through as `application/octet-stream` (media-schemas' `NEUTRAL_CONTENT_TYPE`)
with a `kind:'file'` claim, and `accepts()` fails OPEN on unknown types (the server byte
inspector is the authority). `acceptAttr` projects `spec.accept.formats` through the
media-schemas registry when present.
`validateAndNormalizeUploadFile` accepts `allowIndeterminate`: an unknown-kind
picker file fails OPEN to the neutral content type (server inspection decides)
instead of throwing; the kind-mismatch check still throws for determinate
metadata.
