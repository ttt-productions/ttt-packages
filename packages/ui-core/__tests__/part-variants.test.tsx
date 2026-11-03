import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { Card, CardHeader, CardTitle, CardContent } from '../src/react/components/card.js';
import { Label } from '../src/react/components/label.js';
import { Button } from '../src/react/components/button.js';
import { Select, SelectTrigger, SelectValue } from '../src/react/components/select.js';
import { Dialog, DialogContent, DialogTitle } from '../src/react/components/dialog.js';

// A variant replaces the built-in utilities its recipe class sets, since a utility outranks every
// layered sheet: each case lists the recipe class and the built-ins that would win over it.
function classesOf(element: Element | null): string[] {
  expect(element).not.toBeNull();
  return [...element!.classList];
}

function expectRecipe(element: Element | null, recipe: string, replaced: string[]) {
  const classes = classesOf(element);
  expect(classes).toContain(recipe);
  for (const builtIn of replaced) expect(classes).not.toContain(builtIn);
}

describe('ui-core part variants', () => {
  it('the page card takes the page-card recipe in place of its built-in frame', () => {
    const { container } = render(<Card variant="page">x</Card>);
    expectRecipe(container.firstElementChild, 'page-card', [
      'rounded-lg',
      'border-2',
      'card-border',
      'bg-card',
      'text-card-foreground',
    ]);
  });

  it('the page card header takes the centred or left recipe in place of its built-in padding', () => {
    const { container: centred } = render(<CardHeader variant="page">x</CardHeader>);
    expectRecipe(centred.firstElementChild, 'page-card-header', ['p-6']);
    const { container: left } = render(<CardHeader variant="pageLeft">x</CardHeader>);
    expectRecipe(left.firstElementChild, 'page-card-header-left', ['p-6']);
  });

  it('the page card title takes the page-card-title recipe in place of its built-in type', () => {
    render(<CardTitle variant="page">Title</CardTitle>);
    expectRecipe(screen.getByRole('heading', { name: 'Title' }), 'page-card-title', [
      'text-2xl',
      'font-semibold',
      'leading-none',
      'tracking-tight',
    ]);
  });

  it('the page card content takes the page-card-content recipe in place of its built-in padding', () => {
    const { container } = render(<CardContent variant="page">x</CardContent>);
    expectRecipe(container.firstElementChild, 'page-card-content', ['p-6', 'pt-0']);
  });

  it('each label text look takes its theme-core text class in place of the built-in type', () => {
    for (const [variant, recipe] of [
      ['caption', 'text-caption'],
      ['small', 'text-small'],
      ['label', 'text-label'],
    ] as const) {
      render(<Label variant={variant}>{variant}</Label>);
      expectRecipe(screen.getByText(variant), recipe, ['text-sm', 'font-bold', 'leading-none']);
    }
  });

  it('the action button takes the primary-action-button recipe in place of a built-in height and type size', () => {
    render(<Button size="action">Go</Button>);
    expectRecipe(screen.getByRole('button', { name: 'Go' }), 'primary-action-button', [
      'h-10',
      'text-sm',
      'py-2',
    ]);
  });

  it('the filter select takes the filter-select-trigger recipe in place of its built-in size and paint', () => {
    render(
      <Select>
        <SelectTrigger variant="filter" aria-label="Filter">
          <SelectValue />
        </SelectTrigger>
      </Select>,
    );
    expectRecipe(screen.getByRole('combobox', { name: 'Filter' }), 'filter-select-trigger', [
      'h-10',
      'w-full',
      'rounded-md',
      'border-input',
      'bg-background',
      'px-3',
    ]);
  });

  it('the page dialog title takes the page-card-title recipe in place of its built-in type', () => {
    render(
      <Dialog open>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle variant="page">Heading</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    expectRecipe(screen.getByRole('heading', { name: 'Heading' }), 'page-card-title', [
      'text-lg',
      'font-semibold',
      'leading-none',
      'tracking-tight',
    ]);
  });

  it('every default keeps its built-in look', () => {
    const { container } = render(<Card>x</Card>);
    expect(classesOf(container.firstElementChild)).toEqual(
      expect.arrayContaining(['rounded-lg', 'border-2', 'card-border', 'bg-card']),
    );
    render(<Button>Plain</Button>);
    expect(classesOf(screen.getByRole('button', { name: 'Plain' }))).toEqual(
      expect.arrayContaining(['h-10', 'text-sm']),
    );
  });
});
