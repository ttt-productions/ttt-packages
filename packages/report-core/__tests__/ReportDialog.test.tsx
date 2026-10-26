// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { defineInputFormat } from '@ttt-productions/input-format-core';
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ComponentPropsWithoutRef, ElementRef } from 'react';

// Radix Select does not run in jsdom; a native select stands in for the picker.
vi.mock('@ttt-productions/ui-core/react', async (importOriginal) => {
  const { passThroughModule } = await import('../../../test/typed-mock.js');
  const { forwardRef } = await import('react');
  type UiCore = typeof import('@ttt-productions/ui-core/react');
  type Part<K extends 'SelectTrigger' | 'SelectValue' | 'SelectContent' | 'SelectItem'> =
    ComponentPropsWithoutRef<UiCore[K]>;
  return passThroughModule<UiCore>(importOriginal, {
    Select: ({ value, onValueChange, children }) => (
      <select
        aria-label="reason picker"
        value={value ?? ''}
        onChange={(e) => onValueChange?.(e.target.value)}
      >
        <option value="" />
        {children}
      </select>
    ),
    SelectTrigger: forwardRef<ElementRef<UiCore['SelectTrigger']>, Part<'SelectTrigger'>>(
      () => null,
    ),
    SelectValue: forwardRef<ElementRef<UiCore['SelectValue']>, Part<'SelectValue'>>(() => null),
    SelectContent: forwardRef<ElementRef<UiCore['SelectContent']>, Part<'SelectContent'>>(
      ({ children }, _ref) => <>{children}</>,
    ),
    SelectItem: forwardRef<ElementRef<UiCore['SelectItem']>, Part<'SelectItem'>>(
      ({ value, children }, _ref) => <option value={value}>{children}</option>,
    ),
  });
});

import { ReportCoreProvider } from '../src/react/context/ReportCoreProvider.js';
import { ReportDialog } from '../src/react/components/ReportDialog.js';
import type { ReportCoreConfig } from '../src/contracts/config.js';
import type {
  AdditionalReportAction,
  ReportDialogCopy,
  ReportDialogProps,
} from '../src/react/types-ui-props.js';
import type { SubmitReportRequest, SubmitReportResult } from '../src/schemas/requests.js';

const config: ReportCoreConfig = {
  collections: { reports: 'r', reportGroups: 'g', adminTasks: 't' },
  reportableItems: { post: { displayName: 'Post' } },
  reportReasons: ['Spam', 'Protected Reason'],
  priorityConfig: {
    reasonScores: {},
    itemTypeMultipliers: {},
    additionalReportBonus: 0,
    defaultReasonScore: 0,
    defaultItemTypeMultiplier: 1,
  },
  taskQueues: {},
  reportCommentInput: defineInputFormat({ format: 'none', min: 1, max: 20 }),
};

const copy: ReportDialogCopy = {
  formTitle: 'copy:formTitle',
  formDescription: (label) => `copy:formDescription:${label}`,
  reasonLabel: 'copy:reasonLabel',
  reasonPlaceholder: 'copy:reasonPlaceholder',
  commentLabel: 'copy:commentLabel',
  commentPlaceholder: 'copy:commentPlaceholder',
  cancelLabel: 'copy:cancel',
  submitLabel: 'copy:submit',
  upgradeTitle: 'copy:upgradeTitle',
  upgradeDescription: ({ itemTypeLabel, reason }) =>
    `copy:upgradeDescription:${itemTypeLabel}:${reason}`,
  upgradeBackLabel: 'copy:back',
  upgradeConfirmLabel: 'copy:upgrade',
  alreadyReportedTitle: 'copy:alreadyTitle',
  alreadyReportedDescription: 'copy:alreadyDescription',
  alreadyReportedCloseLabel: 'copy:close',
  discardTitle: 'copy:discardTitle',
  discardDescription: 'copy:discardDescription',
  discardConfirmLabel: 'copy:discard',
  discardKeepLabel: 'copy:keep',
};

const filed: SubmitReportResult = {
  outcome: 'filed',
  ok: true,
  reportId: 'r1',
  reason: 'Spam',
  protectedFork: null,
  caseId: null,
};
const upgraded: SubmitReportResult = {
  outcome: 'upgraded',
  reportId: 'r1',
  reason: 'Protected Reason',
  protectedFork: 'protectedCase',
  caseId: 'c1',
};

afterEach(() => {
  cleanup();
});

function setup(
  options: {
    answers?: Array<SubmitReportResult | Error | Promise<SubmitReportResult>>;
    actions?: AdditionalReportAction[];
    props?: Partial<ReportDialogProps>;
    config?: Partial<ReportCoreConfig>;
  } = {},
) {
  const providerConfig = { ...config, ...options.config } as ReportCoreConfig;
  const answers = [...(options.answers ?? [])];
  const submitReportFn = vi.fn(
    async (_request: SubmitReportRequest): Promise<SubmitReportResult> => {
      const next = answers.shift();
      if (next instanceof Error) throw next;
      return next as SubmitReportResult | Promise<SubmitReportResult>;
    },
  );
  const onOpenChange = vi.fn();
  const onSubmitSuccess = vi.fn();
  const onSubmitError = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const props: ReportDialogProps = {
    open: true,
    onOpenChange,
    itemType: 'post',
    itemId: 'p1',
    reportedUserId: 'owner1',
    reporterUserId: 'reporter1',
    copy,
    onSubmitSuccess,
    onSubmitError,
    ...options.props,
  };
  const ui = (p: ReportDialogProps) => (
    <QueryClientProvider client={queryClient}>
      <ReportCoreProvider
        config={providerConfig}
        submitReportFn={submitReportFn}
        additionalReportActions={options.actions}
      >
        <ReportDialog {...p} />
      </ReportCoreProvider>
    </QueryClientProvider>
  );
  const view = render(ui(props));
  return {
    submitReportFn,
    onOpenChange,
    onSubmitSuccess,
    onSubmitError,
    rerender: (next: Partial<ReportDialogProps>) => view.rerender(ui({ ...props, ...next })),
  };
}

function pick(value: string) {
  fireEvent.change(screen.getByLabelText('reason picker'), { target: { value } });
}

function typeComment(text: string) {
  fireEvent.change(screen.getByLabelText('copy:commentLabel'), { target: { value: text } });
}

async function clickSubmit(name = 'copy:submit') {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
  });
}

describe('ReportDialog outcomes', () => {
  it('a filed report closes the dialog and reports the filing', async () => {
    const t = setup({ answers: [filed] });
    pick('Spam');
    typeComment('bad post');
    await clickSubmit();

    expect(t.submitReportFn).toHaveBeenCalledWith({
      itemType: 'post',
      reportedItemId: 'p1',
      reportedUserId: 'owner1',
      reason: 'Spam',
      comment: 'bad post',
    });
    expect(t.onOpenChange).toHaveBeenCalledWith(false);
    expect(t.onSubmitSuccess).toHaveBeenCalledWith(filed);
  });

  it('an already-reported answer shows the already-reported view and reports no success', async () => {
    const t = setup({ answers: [{ outcome: 'alreadyReported', reportId: 'r1' }] });
    pick('Spam');
    typeComment('again');
    await clickSubmit();

    expect(screen.getByText('copy:alreadyTitle')).toBeInTheDocument();
    expect(screen.getByText('copy:alreadyDescription')).toBeInTheDocument();
    expect(t.onSubmitSuccess).not.toHaveBeenCalled();
    expect(t.onOpenChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'copy:close' }));
    expect(t.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('an upgrade offer shows the upgrade view, and confirming escalates the existing report', async () => {
    const t = setup({
      answers: [
        { outcome: 'upgradeAvailable', reportId: 'r1', reason: 'Protected Reason' },
        upgraded,
      ],
    });
    pick('Protected Reason');
    typeComment('  now worse  ');
    await clickSubmit();

    expect(screen.getByText('copy:upgradeDescription:Post:Protected Reason')).toBeInTheDocument();
    expect(t.onSubmitSuccess).not.toHaveBeenCalled();

    await clickSubmit('copy:upgrade');

    expect(t.submitReportFn).toHaveBeenLastCalledWith(
      expect.objectContaining({
        reason: 'Protected Reason',
        comment: 'now worse',
        confirmUpgrade: true,
      }),
    );
    expect(t.onSubmitSuccess).toHaveBeenCalledWith(upgraded);
    expect(t.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('a confirm that answers already-reported shows that view instead of claiming success', async () => {
    const t = setup({
      answers: [
        { outcome: 'upgradeAvailable', reportId: 'r1', reason: 'Protected Reason' },
        { outcome: 'alreadyReported', reportId: 'r1' },
      ],
    });
    pick('Protected Reason');
    typeComment('x');
    await clickSubmit();
    await clickSubmit('copy:upgrade');

    expect(screen.getByText('copy:alreadyTitle')).toBeInTheDocument();
    expect(t.onSubmitSuccess).not.toHaveBeenCalled();
  });

  it('Back from the upgrade view returns to the form', async () => {
    setup({
      answers: [{ outcome: 'upgradeAvailable', reportId: 'r1', reason: 'Protected Reason' }],
    });
    pick('Protected Reason');
    typeComment('x');
    await clickSubmit();

    fireEvent.click(screen.getByRole('button', { name: 'copy:back' }));

    expect(screen.getByText('copy:formTitle')).toBeInTheDocument();
  });

  it('a failed submit goes to onSubmitError and keeps the dialog open', async () => {
    const boom = new Error('network');
    const t = setup({ answers: [boom] });
    pick('Spam');
    typeComment('x');
    await clickSubmit();

    expect(t.onSubmitError).toHaveBeenCalledWith(boom);
    expect(t.onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByText('copy:formTitle')).toBeInTheDocument();
  });

  it('cannot be dismissed while a submit is in flight', async () => {
    let settle!: (r: SubmitReportResult) => void;
    const t = setup({
      answers: [
        new Promise<SubmitReportResult>((r) => {
          settle = r;
        }),
      ],
    });
    pick('Spam');
    typeComment('x');
    await clickSubmit();

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(t.onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'copy:cancel' })).toBeDisabled();

    await act(async () => settle(filed));
    await waitFor(() => expect(t.onSubmitSuccess).toHaveBeenCalledWith(filed));
  });
});

describe('ReportDialog comments', () => {
  it('requires a comment that is more than whitespace when its declaration has min 1', () => {
    setup();
    pick('Spam');
    expect(screen.getByRole('button', { name: 'copy:submit' })).toBeDisabled();
    typeComment('   ');
    expect(screen.getByRole('button', { name: 'copy:submit' })).toBeDisabled();
    typeComment('why');
    expect(screen.getByRole('button', { name: 'copy:submit' })).toBeEnabled();
  });

  it('submits without a comment when its declaration has min 0', () => {
    setup({
      config: { reportCommentInput: defineInputFormat({ format: 'none', min: 0, max: 20 }) },
    });
    pick('Spam');
    expect(screen.getByRole('button', { name: 'copy:submit' })).toBeEnabled();
  });

  it('refuses a comment over the declared max, and caps the field at it', () => {
    setup();
    pick('Spam');
    expect(screen.getByLabelText('copy:commentLabel')).toHaveAttribute('maxLength', '20');
    typeComment('x'.repeat(21));
    expect(screen.getByRole('button', { name: 'copy:submit' })).toBeDisabled();
  });

  it('refuses a comment with characters its declared format does not allow', () => {
    setup({
      config: { reportCommentInput: defineInputFormat({ format: 'singleLine', min: 1, max: 20 }) },
    });
    pick('Spam');
    typeComment('two\nlines');
    expect(screen.getByRole('button', { name: 'copy:submit' })).toBeDisabled();
  });

  it('sends the comment trimmed, as the server keeps it', async () => {
    const t = setup({ answers: [filed] });
    pick('Spam');
    typeComment('  why  ');
    await clickSubmit();
    expect(t.submitReportFn).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'Spam', comment: 'why' }),
    );
  });

  it('submits nothing without a signed-in reporter', () => {
    setup({ props: { reporterUserId: undefined } });
    pick('Spam');
    typeComment('why');
    expect(screen.getByRole('button', { name: 'copy:submit' })).toBeDisabled();
  });

  it('drops a draft typed by a different reporter', () => {
    const t = setup();
    pick('Spam');
    typeComment('written by the first reporter');

    t.rerender({ reporterUserId: 'reporter2' });

    expect(screen.getByLabelText('copy:commentLabel')).toHaveValue('');
    expect(screen.getByLabelText('reason picker')).toHaveValue('');
  });
});

describe('ReportDialog additional actions', () => {
  it('a hand-off hides the comment, needs none, passes only the target, and closes without a success', async () => {
    const handOff = vi.fn(async () => {});
    const t = setup({
      actions: [{ id: 'removal', label: 'Request removal', kind: 'handOff', handler: handOff }],
    });
    typeComment('private facts typed before choosing');
    pick('__rc_action__:removal');

    expect(screen.queryByLabelText('copy:commentLabel')).toBeNull();
    await clickSubmit('Request removal');

    expect(handOff).toHaveBeenCalledTimes(1);
    expect(handOff.mock.calls[0]).toEqual([
      { itemType: 'post', itemId: 'p1', parentItemId: undefined, reportedUserId: 'owner1' },
    ]);
    expect(t.submitReportFn).not.toHaveBeenCalled();
    expect(t.onOpenChange).toHaveBeenCalledWith(false);
    expect(t.onSubmitSuccess).not.toHaveBeenCalled();
  });

  it('a cancelled hand-off keeps the dialog open and reports the cancel', async () => {
    const cancelled = new DOMException('cancelled', 'AbortError');
    const t = setup({
      actions: [
        {
          id: 'removal',
          label: 'Request removal',
          kind: 'handOff',
          handler: async () => {
            throw cancelled;
          },
        },
      ],
    });
    pick('__rc_action__:removal');
    await clickSubmit('Request removal');

    expect(t.onSubmitError).toHaveBeenCalledWith(cancelled);
    expect(t.onOpenChange).not.toHaveBeenCalled();
  });

  it('a submit action receives the comment and is reported as a completed action', async () => {
    const mark = vi.fn(async (_target: unknown, _comment: string) => {});
    const t = setup({
      actions: [{ id: 'evidence', label: 'Mark evidence', kind: 'submit', handler: mark }],
    });
    pick('__rc_action__:evidence');
    expect(screen.getByRole('button', { name: 'Mark evidence' })).toBeDisabled();
    typeComment('  why  ');
    await clickSubmit('Mark evidence');

    expect(mark).toHaveBeenCalledWith(expect.objectContaining({ itemId: 'p1' }), 'why');
    expect(t.submitReportFn).not.toHaveBeenCalled();
    expect(t.onSubmitSuccess).toHaveBeenCalledWith({
      outcome: 'actionCompleted',
      actionId: 'evidence',
    });
  });
});

describe('ReportDialog unsent comment', () => {
  it('Cancel with a typed comment asks first and keeps the dialog open', () => {
    const t = setup();
    pick('Spam');
    typeComment('half written');

    fireEvent.click(screen.getByRole('button', { name: 'copy:cancel' }));

    expect(screen.getByText('copy:discardTitle')).toBeInTheDocument();
    expect(t.onOpenChange).not.toHaveBeenCalled();
  });

  it('Escape with a typed comment asks first', () => {
    const t = setup();
    typeComment('half written');

    fireEvent.keyDown(screen.getByLabelText('copy:commentLabel'), { key: 'Escape' });

    expect(screen.getByText('copy:discardTitle')).toBeInTheDocument();
    expect(t.onOpenChange).not.toHaveBeenCalled();
  });

  it('confirming the prompt drops the comment and closes the dialog', async () => {
    const t = setup();
    typeComment('half written');
    fireEvent.click(screen.getByRole('button', { name: 'copy:cancel' }));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'copy:discard' }));
    });

    expect(t.onOpenChange).toHaveBeenCalledWith(false);
    t.rerender({ open: true });
    expect(screen.getByLabelText('copy:commentLabel')).toHaveValue('');
  });

  it('keeping the comment leaves the dialog open with it', () => {
    const t = setup();
    typeComment('half written');
    fireEvent.click(screen.getByRole('button', { name: 'copy:cancel' }));

    fireEvent.click(screen.getByRole('button', { name: 'copy:keep' }));

    expect(t.onOpenChange).not.toHaveBeenCalled();
    expect(screen.queryByText('copy:discardTitle')).toBeNull();
    expect(screen.getByLabelText('copy:commentLabel')).toHaveValue('half written');
  });

  it('Cancel with nothing typed closes without asking, even with a reason picked', () => {
    const t = setup();
    pick('Spam');

    fireEvent.click(screen.getByRole('button', { name: 'copy:cancel' }));

    expect(t.onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByText('copy:discardTitle')).toBeNull();
  });
});
