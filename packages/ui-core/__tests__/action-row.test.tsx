import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ActionRow } from '../src/react/components/action-row';

describe('ActionRow', () => {
  it("is one button named by the row's content, which runs the row's action", () => {
    const onClick = vi.fn();
    render(<ActionRow onClick={onClick}><span>Help needed</span> · <span>Ada</span></ActionRow>);
    fireEvent.click(screen.getByRole('button', { name: 'Help needed · Ada' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("a control inside the row is its own button, outside the row's, and runs only its own action", () => {
    const onClick = vi.fn();
    const onRetry = vi.fn();
    render(
      <ActionRow onClick={onClick}>
        <span>Help needed</span>
        <button type="button" onClick={onRetry}>Try again</button>
      </ActionRow>,
    );
    const retry = screen.getByRole('button', { name: 'Try again' });
    const row = screen.getByRole('button', { name: /Help needed/ });
    expect(row).not.toContainElement(retry);
    fireEvent.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('comes before the controls inside it in tab order', () => {
    render(
      <ActionRow onClick={vi.fn()}>
        <span>Help needed</span>
        <button type="button">Try again</button>
      </ActionRow>,
    );
    const [first, second] = screen.getAllByRole('button');
    expect(first).toHaveAccessibleName(/Help needed/);
    expect(second).toHaveAccessibleName('Try again');
  });

  it('a disabled row runs nothing, and a busy row says so', () => {
    const onClick = vi.fn();
    const { rerender } = render(<ActionRow onClick={onClick} disabled><span>Task</span></ActionRow>);
    const row = screen.getByRole('button', { name: 'Task' });
    expect(row).toBeDisabled();
    fireEvent.click(row);
    expect(onClick).not.toHaveBeenCalled();
    rerender(<ActionRow onClick={onClick} disabled busy><span>Task</span></ActionRow>);
    expect(screen.getByRole('button', { name: 'Task' })).toHaveAttribute('aria-busy', 'true');
  });

  it("a link row's target is the app's own link, named by the row's content, with the row's controls outside it", () => {
    const onRetry = vi.fn();
    render(
      <ActionRow renderLink={(target) => <a href="/teams/7" data-app-link="" {...target} />}>
        <span>Team Seven</span>
        <button type="button" onClick={onRetry}>Retry</button>
      </ActionRow>,
    );
    const link = screen.getByRole('link', { name: /Team Seven/ });
    expect(link).toHaveAttribute('href', '/teams/7');
    expect(link).toHaveAttribute('data-app-link');
    const retry = screen.getByRole('button', { name: 'Retry' });
    expect(link).not.toContainElement(retry);
    fireEvent.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('a link row comes before the controls inside it in tab order', () => {
    render(
      <ActionRow renderLink={(target) => <a href="/teams/7" {...target} />}>
        <span>Team Seven</span>
        <button type="button">Retry</button>
      </ActionRow>,
    );
    const link = screen.getByRole('link', { name: /Team Seven/ });
    const retry = screen.getByRole('button', { name: 'Retry' });
    expect(link.compareDocumentPosition(retry) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
