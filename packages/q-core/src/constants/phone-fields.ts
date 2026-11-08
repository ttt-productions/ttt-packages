import { definePhoneFormat } from '@ttt-productions/input-format-core';

export const CONTACT_PHONE_INPUT = definePhoneFormat({
  label: 'Contact phone',
  format: 'us',
  required: true,
});
export const OPTIONAL_CONTACT_PHONE_INPUT = definePhoneFormat({
  label: 'Default contact phone',
  format: 'us',
  required: false,
});
