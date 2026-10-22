import { checkInputFormat, type InputFormatSpec } from '@ttt-productions/input-format-core';

interface CallerAttributes {
  value?: unknown;
  readOnly?: boolean;
  'aria-required'?: boolean | 'true' | 'false';
  'aria-invalid'?: boolean | 'true' | 'false' | 'grammar' | 'spelling';
}

export function formatControlAttributes(spec: InputFormatSpec, props: CallerAttributes) {
  if (props.readOnly) {
    return {
      maxLength: spec.max,
      'aria-required': props['aria-required'],
      'aria-invalid': props['aria-invalid'],
    };
  }
  const result = typeof props.value === 'string' ? checkInputFormat(props.value, spec) : null;
  const malformed = result !== null && !result.ok && result.issue !== 'tooShort';
  return {
    maxLength: spec.max,
    'aria-required': props['aria-required'] ?? (spec.min > 0 ? true : undefined),
    'aria-invalid': props['aria-invalid'] ?? (malformed ? true : undefined),
  };
}

/** The native value setter plus an input event is what React hears as a typed change. */
export function tidyOnBlur(box: HTMLInputElement | HTMLTextAreaElement, spec: InputFormatSpec) {
  if (box.readOnly || box.disabled) return;
  const kept = checkInputFormat(box.value, spec).value;
  if (kept === box.value) return;
  const prototype =
    box instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(box, kept);
  box.dispatchEvent(new Event('input', { bubbles: true }));
}
