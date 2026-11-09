import { definePasswordPolicy, defineRegistrationEngineSettings } from '@ttt-productions/auth-core';

export const PASSWORD_POLICY = definePasswordPolicy();

export const REGISTRATION_ENGINE_SETTINGS = defineRegistrationEngineSettings();
