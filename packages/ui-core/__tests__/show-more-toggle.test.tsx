import { describe, it, expect, vi } from 'vitest';
import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShowMoreToggle } from '../src/react/components/show-more-toggle';
import { buttonVariants } from '../src/react/components/button';
import * as reactEntry from '../src/react/index';

function Harness({ initial = false }: { initial?: boolean }) {
  const [expanded, setExpanded] = React.useState(initial);
  return (
    <>
      <ShowMoreToggle
        expanded={expanded}
        onExpandedChange={setExpanded}
        openLabel="Show the rumors"
        closeLabel="Hide the rumors"
        controls="rumors"
      />
      {expanded ? <div id="rumors">The rumors</div> : null}
    </>
  );
}

describe('ShowMoreToggle — the one show-more disclosure control', () => {
  it('starts with the open label, collapsed, and names what it controls', () => {
    render(<Harness />);
    const toggle = screen.getByRole('button', { name: 'Show the rumors' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('aria-controls', 'rumors');
    expect(screen.queryByText('The rumors')).not.toBeInTheDocument();
  });

  it('a press shows the content, switches to the close label, and turns the chevron over', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Show the rumors' }));
    const toggle = screen.getByRole('button', { name: 'Hide the rumors' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('The rumors')).toBeInTheDocument();
    expect(toggle.querySelector('svg')).toHaveClass('rotate-180');
  });

  it('a second press hides it again', () => {
    render(<Harness initial />);
    fireEvent.click(screen.getByRole('button', { name: 'Hide the rumors' }));
    expect(screen.getByRole('button', { name: 'Show the rumors' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('The rumors')).not.toBeInTheDocument();
  });

  it('reports the next state to its owner rather than holding its own', () => {
    const onExpandedChange = vi.fn();
    render(<ShowMoreToggle expanded={false} onExpandedChange={onExpandedChange} openLabel="More" closeLabel="Less" />);
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(onExpandedChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole('button', { name: 'More' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('is always the small outline button, never a form submit, with a decorative chevron', () => {
    render(<ShowMoreToggle expanded={false} onExpandedChange={() => {}} openLabel="More" closeLabel="Less" />);
    const toggle = screen.getByRole('button', { name: 'More' });
    for (const c of buttonVariants({ variant: 'outline', size: 'sm' }).split(/\s+/).filter(Boolean)) {
      expect(toggle).toHaveClass(c);
    }
    expect(toggle).toHaveAttribute('type', 'button');
    expect(toggle.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('is exported from the react entry', () => {
    expect(reactEntry.ShowMoreToggle).toBe(ShowMoreToggle);
  });
});
