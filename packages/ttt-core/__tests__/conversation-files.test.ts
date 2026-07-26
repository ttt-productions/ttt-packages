// Conversation Files contract tests — the package-side acceptance suite for the
// "Conversation Files replace chat attachments" replacement. Covers the canonical
// data model (ref union, owner record purity, path builders), the mode-varied
// limits, the capability/origin coverage, and the removal of every chat-attachment
// contract this package used to own.

import { describe, it, expect } from 'vitest';
import {
  ConversationFileRefSchema,
  CONVERSATION_FILE_SCOPE_KINDS,
  type ConversationFileRef,
} from '../src/media/conversation-file-ref.js';
import { ConversationFileTargetInfoSchema, parseTargetInfo } from '../src/media/target-info.js';
import { DeleteConversationFileInputSchema } from '../src/schemas/conversation-files.js';
import { UploadConversationFileVariablesSchema } from '../src/upload-variables/upload-conversation-file-variables.js';
import { FileOriginSchema } from '../src/media/file-origin.js';
import { TTT_MEDIA_SPECS } from '../src/media/ttt-media-specs.js';
import { PHOTODNA_COVERAGE_MATRIX } from '../src/media/photodna-coverage.js';
import { fileOriginRowLabel } from '../src/media/upload-tray-display.js';
import { buildTempUploadPath } from '../src/paths/storage-paths.js';
import { PATH_BUILDERS } from '../src/paths/path-builders.js';
import { COLLECTION_REFS } from '../src/paths/collection-refs.js';
import { toPath } from '../src/paths/utils.js';
import { ConversationFileSchema, ChatMessageV1Schema } from '../src/doc-schemas/messaging.js';
import {
  MediaPublicationKindSchema,
  MediaServingScopeSchema,
  MediaAssetOwnerTypeSchema,
  MediaCopyReasonSchema,
} from '../src/doc-schemas/media-assets.js';
import {
  TargetLocatorV1Schema,
  TargetLocatorKindSchema,
  NciiTargetSurfaceSchema,
  ReportableItemTypeSchema,
  CONTENT_ACTION_PANEL_ITEM_TYPES,
  CHAT_REPORT_ITEM_TYPES,
  type TargetLocatorV1,
} from '../src/doc-schemas/safety/foundation.js';
import { ResolvedReportTargetV1Schema } from '../src/doc-schemas/safety/report.js';
import {
  REPORTABLE_ITEM_LABELS,
  REPORT_ITEM_TYPE_MULTIPLIERS,
} from '../src/report/report-config-values.js';
import { ModerateReportedContentInputSchema } from '../src/schemas/admin.js';
import {
  normalizedTargetKey,
  surfaceLabelFor,
  targetLocatorSummary,
  isTttHostedLocator,
} from '../src/safety/ncii-intake-derivations.js';
import { COLLECTION_SCHEMAS } from '../src/doc-schemas/registry.js';
import {
  CAPABILITY_REGISTRY,
  ALL_CAPABILITY_IDS,
  ADULT_ONLY_UPLOAD_ORIGINS,
  uploadOriginRequires18Plus,
} from '../src/capabilities/capability-registry.js';
import { MESSAGING_SURFACES } from '../src/capabilities/messaging-surfaces.js';
import {
  MAX_CONVERSATION_FILES,
  MAX_CONVERSATION_FILE_STORAGE_BYTES,
} from '../src/constants/conversation-files.js';
import { ACTIVE_LIMITS, CHARTER_LIMITS, FULL_LIMITS } from '../src/constants/app-mode.js';

// ───────────────────────────── ConversationFileRef ─────────────────────────────

describe('ConversationFileRef — EXACTLY the two supported conversation scopes', () => {
  it('accepts guildInvite and adminSupport', () => {
    const invite: ConversationFileRef = { kind: 'guildInvite', guildInviteId: 'inv_1' };
    const admin: ConversationFileRef = { kind: 'adminSupport', adminDispatchId: 'ad_1' };
    expect(ConversationFileRefSchema.parse(invite)).toEqual(invite);
    expect(ConversationFileRefSchema.parse(admin)).toEqual(admin);
  });

  it('has exactly two members, and the kind list matches the schema', () => {
    expect(ConversationFileRefSchema.options).toHaveLength(2);
    expect([...CONVERSATION_FILE_SCOPE_KINDS].sort()).toEqual(['adminSupport', 'guildInvite']);
  });

  it('REJECTS guildChannel — guild chat channels have no Conversation Files', () => {
    expect(() =>
      ConversationFileRefSchema.parse({
        kind: 'guildChannel',
        workProjectId: 'wp_1',
        guildChatChannelId: 'ch_1',
      }),
    ).toThrow();
    expect(() => ConversationFileRefSchema.parse({ kind: 'guildChannel' })).toThrow();
  });

  it('rejects mixed or extra scope identifiers', () => {
    expect(() =>
      ConversationFileRefSchema.parse({ kind: 'guildInvite', guildInviteId: 'i', adminDispatchId: 'a' }),
    ).toThrow();
    expect(() =>
      ConversationFileRefSchema.parse({ kind: 'adminSupport', adminDispatchId: 'a', workProjectId: 'wp' }),
    ).toThrow();
    expect(() => ConversationFileRefSchema.parse({ kind: 'guildInvite', guildInviteId: '' })).toThrow();
  });

  it('is the conversation-file target-info schema verbatim (one declaration)', () => {
    expect(ConversationFileTargetInfoSchema).toBe(ConversationFileRefSchema);
  });
});

// ─────────────────────────── conversation-file origin ───────────────────────────

describe('the conversation-file upload origin', () => {
  it('is a canonical FileOrigin and the chat-attachment origin is gone', () => {
    expect(FileOriginSchema.parse('conversation-file')).toBe('conversation-file');
    expect(FileOriginSchema.options).not.toContain('guild-chat-message-attachment');
  });

  it('has a TTT_MEDIA_SPECS entry accepting image + video + audio', () => {
    const spec = TTT_MEDIA_SPECS['conversation-file'];
    expect(spec).toBeDefined();
    expect([...(spec.accept?.kinds ?? [])].sort()).toEqual(['audio', 'image', 'video']);
    expect(spec.processing?.image).toBeDefined();
    expect(spec.processing?.video).toBeDefined();
    expect(spec.processing?.audio).toBeDefined();
  });

  it('participates in the derived PhotoDNA coverage matrix on all three branches', () => {
    expect(PHOTODNA_COVERAGE_MATRIX['conversation-file'].requiredBranches).toEqual([
      'imagePhotoDna',
      'videoFramePhotoDna',
      'audioSpoofGuard',
    ]);
    // Coverage stays total over the origin registry after the swap.
    for (const origin of FileOriginSchema.options) {
      expect(PHOTODNA_COVERAGE_MATRIX[origin]).toBeDefined();
    }
  });

  it('uses the canonical temp upload path builder', () => {
    expect(buildTempUploadPath('conversation-file', 'u_1', 'pm_1')).toBe(
      'uploads/conversation-file/u_1/pm_1',
    );
  });

  it('has an upload-tray label', () => {
    expect(fileOriginRowLabel['conversation-file']).toBe('Conversation file');
  });

  it('routes through parseTargetInfo to the strict ref schema', () => {
    expect(parseTargetInfo('conversation-file', { kind: 'adminSupport', adminDispatchId: 'ad_1' })).toEqual({
      kind: 'adminSupport',
      adminDispatchId: 'ad_1',
    });
  });
});

// ───────────────────────── ConversationFileSchema purity ─────────────────────────

describe('ConversationFileSchema — references and metadata ONLY', () => {
  const valid = {
    conversationFileId: 'pm_1',
    mediaAssetId: 'ma_1',
    name: 'storyboard.png',
    mediaKind: 'image' as const,
    contentType: 'image/png',
    sizeBytes: 12_345,
    uploadedByUid: 'u_1',
    createdAt: 1_700_000_000_000,
  };

  it('parses the canonical record', () => {
    expect(ConversationFileSchema.parse(valid)).toEqual(valid);
  });

  it('declares exactly the canonical fields', () => {
    expect(Object.keys(ConversationFileSchema.shape).sort()).toEqual(
      [
        'contentType',
        'conversationFileId',
        'createdAt',
        'mediaAssetId',
        'mediaKind',
        'name',
        'sizeBytes',
        'uploadedByUid',
      ],
    );
  });

  it('declares NO lifecycle/status field (pendingMedia + mediaAssets own the lifecycle)', () => {
    for (const forbidden of ['status', 'ready', 'publicationState', 'servingStatus', 'progress']) {
      expect(Object.keys(ConversationFileSchema.shape)).not.toContain(forbidden);
    }
  });

  it('declares NO URL and NO Firebase staging path', () => {
    for (const forbidden of ['url', 'downloadUrl', 'signedUrl', 'gatewayUrl', 'storagePath', 'pendingStoragePath']) {
      expect(Object.keys(ConversationFileSchema.shape)).not.toContain(forbidden);
    }
  });

  it('declares NO display-identity snapshot (ARCH-103 — uid reference only)', () => {
    for (const forbidden of ['displayName', 'username', 'profilePictureUrl', 'avatarUrl', 'workName', 'uploadedBy']) {
      expect(Object.keys(ConversationFileSchema.shape)).not.toContain(forbidden);
    }
    expect(Object.keys(ConversationFileSchema.shape)).toContain('uploadedByUid');
  });

  it('rejects a non-canonical mediaKind', () => {
    expect(ConversationFileSchema.safeParse({ ...valid, mediaKind: 'file' }).success).toBe(false);
  });
});

// ────────────────────── Chat message schemas are attachment-free ──────────────────────

describe('the stored chat-message schema carries no file reference', () => {
  const message = { senderId: 'u_1', text: 'hello', createdAt: 1_700_000_000_000 };

  it('declares no attachment (or attachment-shaped) field', () => {
    const keys = Object.keys(ChatMessageV1Schema.shape);
    expect(keys.filter((k) => /attachment/i.test(k))).toEqual([]);
    for (const forbidden of ['attachment', 'attachments', 'mediaAssetId', 'attachmentState']) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it('drops a client-supplied attachment instead of persisting it', () => {
    const parsed = ChatMessageV1Schema.parse({
      ...message,
      attachment: { id: 'att_1', name: 'x.png', type: 'image', size: 1, storagePath: 'p' },
    });
    expect(parsed).not.toHaveProperty('attachment');
    expect(parsed).toEqual(message);
  });

  it('still carries its text-only reply pointer', () => {
    const replyTo = { messageId: 'm_1', senderId: 'u_2', messagePreview: 'earlier' };
    expect(ChatMessageV1Schema.parse({ ...message, replyTo }).replyTo).toEqual(replyTo);
  });
});

// ─────────────────────────────── Canonical paths ───────────────────────────────

describe('Conversation Files path builders + collection registration', () => {
  it('builds the two canonical nested document paths', () => {
    expect(toPath(PATH_BUILDERS.guildInviteConversationFile('inv_1', 'cf_1'))).toBe(
      'guildInviteConversations/inv_1/conversationFiles/cf_1',
    );
    expect(toPath(PATH_BUILDERS.adminDispatchConversationFile('ad_1', 'cf_1'))).toBe(
      'pendingAdminDispatches/ad_1/conversationFiles/cf_1',
    );
  });

  it('builds the matching collection refs for the list surfaces', () => {
    expect(toPath(COLLECTION_REFS.guildInviteConversationFiles('inv_1'))).toBe(
      'guildInviteConversations/inv_1/conversationFiles',
    );
    expect(toPath(COLLECTION_REFS.adminDispatchConversationFiles('ad_1'))).toBe(
      'pendingAdminDispatches/ad_1/conversationFiles',
    );
  });

  it('binds both paths to ConversationFileSchema in the doc-schema registry', () => {
    const registry = COLLECTION_SCHEMAS as Record<string, unknown>;
    expect(registry['guildInviteConversations/{guildInviteId}/conversationFiles/{conversationFileId}'])
      .toBe(ConversationFileSchema);
    expect(registry['pendingAdminDispatches/{adminDispatchId}/conversationFiles/{conversationFileId}'])
      .toBe(ConversationFileSchema);
  });

  it('registers NO guild-channel conversationFiles path', () => {
    for (const key of Object.keys(COLLECTION_SCHEMAS)) {
      if (key.includes('conversationFiles')) {
        expect(key.includes('guildChatChannels')).toBe(false);
      }
    }
  });
});

// ────────────────────────── Media serving / publication ──────────────────────────

describe('media contracts after the replacement', () => {
  it('the publication registry has conversationFile and neither removed attachment kind', () => {
    expect(MediaPublicationKindSchema.parse('conversationFile')).toBe('conversationFile');
    expect(MediaPublicationKindSchema.options).not.toContain('chatAttachment');
    expect(MediaPublicationKindSchema.options).not.toContain('adminSupportAttachment');
  });

  it('the serving scope keeps guildInvite + adminSupport and drops guildChannel', () => {
    expect(MediaServingScopeSchema.parse({ kind: 'guildInvite', guildInviteId: 'i' }).kind).toBe('guildInvite');
    expect(MediaServingScopeSchema.parse({ kind: 'adminSupport', adminDispatchId: 'a' }).kind).toBe('adminSupport');
    expect(() =>
      MediaServingScopeSchema.parse({ kind: 'guildChannel', workProjectId: 'w', guildChatChannelId: 'c' }),
    ).toThrow();
    // Work media keeps its own scopes untouched.
    expect(MediaServingScopeSchema.parse({ kind: 'workProject', workProjectId: 'w' }).kind).toBe('workProject');
    expect(
      MediaServingScopeSchema.parse({ kind: 'workFileFolder', workProjectId: 'w', workFileFolderId: 'f' }).kind,
    ).toBe('workFileFolder');
  });

  it('every ConversationFileRef kind has a matching serving-scope kind', () => {
    for (const kind of CONVERSATION_FILE_SCOPE_KINDS) {
      const ref =
        kind === 'guildInvite'
          ? { kind, guildInviteId: 'i' }
          : { kind, adminDispatchId: 'a' };
      expect(MediaServingScopeSchema.parse(ref).kind).toBe(kind);
    }
  });

  it('the asset owner type is conversationFile, not the removed guildChatAttachment', () => {
    expect(MediaAssetOwnerTypeSchema.parse('conversationFile')).toBe('conversationFile');
    expect(MediaAssetOwnerTypeSchema.options).not.toContain('guildChatAttachment');
  });
});

// ────────────────────────────── Capability coverage ──────────────────────────────

describe('capability coverage is exhaustive after the rename', () => {
  it('messaging.fileShare replaced messaging.attachment with the SAME adult/bilateral policy', () => {
    const def = CAPABILITY_REGISTRY['messaging.fileShare'];
    expect(def.id).toBe('messaging.fileShare');
    expect(def.ageRequirement).toBe('adult18Plus');
    expect(def.bilateral).toBe(true);
    expect(def.uploadOrigins).toEqual(['conversation-file']);
    expect(ALL_CAPABILITY_IDS).not.toContain('messaging.attachment');
  });

  it('the registry stays 1:1 with CapabilityId and every entry is self-consistent', () => {
    for (const id of ALL_CAPABILITY_IDS) {
      expect(CAPABILITY_REGISTRY[id].id).toBe(id);
    }
  });

  it('every capability upload origin is a canonical FileOrigin', () => {
    for (const id of ALL_CAPABILITY_IDS) {
      for (const origin of CAPABILITY_REGISTRY[id].uploadOrigins) {
        expect(FileOriginSchema.options).toContain(origin);
      }
    }
  });

  it('conversation-file is an 18+ origin at the startUpload gate', () => {
    expect(ADULT_ONLY_UPLOAD_ORIGINS).toContain('conversation-file');
    expect(ADULT_ONLY_UPLOAD_ORIGINS).not.toContain('guild-chat-message-attachment');
    expect(uploadOriginRequires18Plus('conversation-file')).toBe(true);
    expect(uploadOriginRequires18Plus('guild-chat-message-attachment')).toBe(false);
  });

  it('the messaging-surface inventory names the file-share capability and only bilateral ones', () => {
    const fileShare = MESSAGING_SURFACES.filter((s) => s.capability === 'messaging.fileShare');
    expect(fileShare).toHaveLength(1);
    for (const surface of MESSAGING_SURFACES) {
      expect(CAPABILITY_REGISTRY[surface.capability].bilateral).toBe(true);
    }
  });
});

// ─────────────────────────────────── Limits ───────────────────────────────────

describe('Conversation Files limits derive from the byMode source of truth', () => {
  it('charter 10 files / 500 MiB, full 20 files / 1 GiB', () => {
    expect(CHARTER_LIMITS.conversation).toEqual({
      maxConversationFiles: 10,
      maxConversationFileStorageBytes: 500 * 1024 * 1024,
    });
    expect(FULL_LIMITS.conversation).toEqual({
      maxConversationFiles: 20,
      maxConversationFileStorageBytes: 1024 * 1024 * 1024,
    });
  });

  it('the enforcement constants are the ACTIVE_LIMITS values — no bare literals (ENG-005)', () => {
    expect(MAX_CONVERSATION_FILES).toBe(ACTIVE_LIMITS.conversation.maxConversationFiles);
    expect(MAX_CONVERSATION_FILE_STORAGE_BYTES).toBe(
      ACTIVE_LIMITS.conversation.maxConversationFileStorageBytes,
    );
  });

  it('both limit sets declare the same conversation keys (mode parity)', () => {
    expect(Object.keys(CHARTER_LIMITS.conversation).sort()).toEqual(
      Object.keys(FULL_LIMITS.conversation).sort(),
    );
  });
});

// ───────────────────────── Safety locator + surface enums ─────────────────────────

describe('the safety target locator points at Conversation Files, not chat attachments', () => {
  it('accepts a conversationFile locator for each supported conversation scope', () => {
    for (const kind of CONVERSATION_FILE_SCOPE_KINDS) {
      const conversation =
        kind === 'guildInvite'
          ? { kind, guildInviteId: 'inv-1' }
          : { kind, adminDispatchId: 'disp-1' };
      const parsed = TargetLocatorV1Schema.parse({
        kind: 'conversationFile',
        conversation,
        conversationFileId: 'cf-1',
        mediaAssetId: 'asset-1',
      });
      expect(parsed.kind).toBe('conversationFile');
    }
    expect(TargetLocatorKindSchema.parse('conversationFile')).toBe('conversationFile');
  });

  it('cannot express a GUILD-CHANNEL conversation file (channels have no files)', () => {
    expect(
      TargetLocatorV1Schema.safeParse({
        kind: 'conversationFile',
        conversation: { kind: 'guildChannel', workProjectId: 'w', guildChatChannelId: 'c' },
        conversationFileId: 'cf-1',
        mediaAssetId: 'asset-1',
      }).success,
    ).toBe(false);
  });

  it('rejects a conversationFile locator missing the file or asset id, or carrying extras', () => {
    const conversation = { kind: 'guildInvite' as const, guildInviteId: 'inv-1' };
    const base = { kind: 'conversationFile', conversation, conversationFileId: 'cf-1', mediaAssetId: 'a-1' };
    const { conversationFileId: _cf, ...noFileId } = base;
    const { mediaAssetId: _ma, ...noAssetId } = base;
    expect(TargetLocatorV1Schema.safeParse(noFileId).success).toBe(false);
    expect(TargetLocatorV1Schema.safeParse(noAssetId).success).toBe(false);
    expect(TargetLocatorV1Schema.safeParse({ ...base, messageId: 'm-1' }).success).toBe(false);
  });

  it('drops the chatAttachment locator kind entirely', () => {
    expect(TargetLocatorKindSchema.safeParse('chatAttachment').success).toBe(false);
    expect(
      TargetLocatorV1Schema.safeParse({
        kind: 'chatAttachment',
        channelId: 'c',
        messageId: 'm',
        attachmentId: 'a',
      }).success,
    ).toBe(false);
  });

  it('derives a stable, distinct normalized key + privacy-safe label per conversation file', () => {
    const invite: TargetLocatorV1 = {
      kind: 'conversationFile',
      conversation: { kind: 'guildInvite', guildInviteId: 'inv-1' },
      conversationFileId: 'cf-1',
      mediaAssetId: 'asset-1',
    };
    const dispatch: TargetLocatorV1 = {
      kind: 'conversationFile',
      conversation: { kind: 'adminSupport', adminDispatchId: 'disp-1' },
      conversationFileId: 'cf-1',
      mediaAssetId: 'asset-1',
    };
    expect(normalizedTargetKey(invite)).toBe(normalizedTargetKey({ ...invite }));
    expect(normalizedTargetKey(invite)).not.toBe(normalizedTargetKey(dispatch));
    expect(surfaceLabelFor(invite)).toBe('Conversation file');
    expect(targetLocatorSummary(invite, true)).toEqual({
      kind: 'conversationFile',
      surfaceLabel: 'Conversation file',
      hasResolvedTarget: true,
    });
    // A Conversation File is server-resolvable (TTT-hosted), like the locator it replaced.
    expect(isTttHostedLocator(invite)).toBe(true);
  });

  it('the NCII removal surface enum names conversationFile, not chatAttachment', () => {
    expect(NciiTargetSurfaceSchema.parse('conversationFile')).toBe('conversationFile');
    expect(NciiTargetSurfaceSchema.options).not.toContain('chatAttachment');
  });

  it('the media copy-reason vocabulary drops chat_derivative (chat owns no media)', () => {
    expect(MediaCopyReasonSchema.options).not.toContain('chat_derivative');
    expect(MediaCopyReasonSchema.parse('original')).toBe('original');
  });
});

// ─────────────────────── Reportable / moderatable surface ───────────────────────

describe('a Conversation File is reportable and actionable in its own right', () => {
  it('is a canonical ReportableItemType (no chat message required)', () => {
    expect(ReportableItemTypeSchema.parse('conversation-file')).toBe('conversation-file');
  });

  it('carries a display label and a priority multiplier (both maps are Record-complete)', () => {
    expect(REPORTABLE_ITEM_LABELS['conversation-file']).toBe('Conversation File');
    // Mirrors `work-asset` — the other shared-FILE surface — not the 0.8 chat-message weight.
    expect(REPORT_ITEM_TYPE_MULTIPLIERS['conversation-file']).toBe(
      REPORT_ITEM_TYPE_MULTIPLIERS['work-asset'],
    );
    for (const itemType of ReportableItemTypeSchema.options) {
      expect(typeof REPORTABLE_ITEM_LABELS[itemType]).toBe('string');
      expect(typeof REPORT_ITEM_TYPE_MULTIPLIERS[itemType]).toBe('number');
    }
  });

  it('renders the content-action panel and is accepted by both admin content actions', () => {
    expect(CONTENT_ACTION_PANEL_ITEM_TYPES).toContain('conversation-file');
    expect(
      ModerateReportedContentInputSchema.safeParse({
        reportGroupId: 'rg-1',
        targetType: 'conversation-file',
        reportedItemId: 'cf-1',
        action: 'remove',
        reason: 'policy violation',
      }).success,
    ).toBe(true);
  });

  it('is NOT a DO-transported chat report type (it has a Firestore owner doc)', () => {
    expect(CHAT_REPORT_ITEM_TYPES).not.toContain('conversation-file');
  });

  it('the resolver result carries no attachmentId mirror', () => {
    expect(Object.keys(ResolvedReportTargetV1Schema.shape)).not.toContain('attachmentId');
    const resolved = {
      schemaVersion: 1 as const,
      itemType: 'conversation-file' as const,
      canonicalParentPath: 'guildInviteConversations/inv-1/conversationFiles',
      canonicalItemId: 'cf-1',
      revision: 1,
      ownerUid: 'u-1',
      ownerBlockKey: 'bk-1',
      mediaAssetId: 'asset-1',
      locator: {
        kind: 'conversationFile' as const,
        conversation: { kind: 'guildInvite' as const, guildInviteId: 'inv-1' },
        conversationFileId: 'cf-1',
        mediaAssetId: 'asset-1',
      },
      resolvedAt: 1,
    };
    expect(ResolvedReportTargetV1Schema.safeParse(resolved).success).toBe(true);
    // `.strict()` — a re-introduced attachmentId is rejected outright.
    expect(
      ResolvedReportTargetV1Schema.safeParse({ ...resolved, attachmentId: 'att-1' }).success,
    ).toBe(false);
  });
});

describe('Conversation File wire contracts (delete input + upload variables)', () => {
  it('DeleteConversationFileInputSchema accepts both scope kinds and only them', () => {
    expect(
      DeleteConversationFileInputSchema.safeParse({
        conversation: { kind: 'guildInvite', guildInviteId: 'inv-1' },
        conversationFileId: 'cf-1',
      }).success,
    ).toBe(true);
    expect(
      DeleteConversationFileInputSchema.safeParse({
        conversation: { kind: 'adminSupport', adminDispatchId: 'd-1' },
        conversationFileId: 'cf-1',
      }).success,
    ).toBe(true);
    // Guild channels have no Conversation Files — unrepresentable at the wire boundary.
    expect(
      DeleteConversationFileInputSchema.safeParse({
        conversation: { kind: 'guildChannel', workProjectId: 'w-1', guildChatChannelId: 'c-1' },
        conversationFileId: 'cf-1',
      }).success,
    ).toBe(false);
    expect(
      DeleteConversationFileInputSchema.safeParse({
        conversation: { kind: 'guildInvite', guildInviteId: 'inv-1' },
        conversationFileId: '',
      }).success,
    ).toBe(false);
    expect(
      DeleteConversationFileInputSchema.safeParse({
        conversation: { kind: 'guildInvite', guildInviteId: 'inv-1' },
        conversationFileId: 'cf-1',
        extra: 'x',
      }).success,
    ).toBe(false);
  });

  it('UploadConversationFileVariablesSchema is strict and two-kind (MEDIA-005)', () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    expect(
      UploadConversationFileVariablesSchema.safeParse({
        conversation: { kind: 'adminSupport', adminDispatchId: 'd-1' },
        file,
      }).success,
    ).toBe(true);
    expect(
      UploadConversationFileVariablesSchema.safeParse({
        conversation: { kind: 'guildChannel', workProjectId: 'w-1', guildChatChannelId: 'c-1' },
        file,
      }).success,
    ).toBe(false);
    expect(
      UploadConversationFileVariablesSchema.safeParse({
        conversation: { kind: 'guildInvite', guildInviteId: 'inv-1' },
        file,
        extra: 'x',
      }).success,
    ).toBe(false);
  });
});
