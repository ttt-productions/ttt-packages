import { definePasswordPolicy, defineRegistrationEngineSettings } from '@ttt-productions/auth-core';

export const PASSWORD_POLICY = definePasswordPolicy({ minLength: 6, maxLength: 74 });

export const REGISTRATION_ENGINE_SETTINGS = defineRegistrationEngineSettings({
  functionTimeoutSeconds: 60,
});
