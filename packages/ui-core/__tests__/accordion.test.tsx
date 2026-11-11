import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../src/react/components/accordion.js';

describe('AccordionContent — clips, never scrolls', () => {
  it('the content region clips its overflow and is not a scroll container', () => {
    render(
      <Accordion type="single" defaultValue="one">
        <AccordionItem value="one">
          <AccordionTrigger>Section</AccordionTrigger>
          <AccordionContent>Body</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );
    const region = screen.getByRole('region');
    expect(region).toHaveClass('overflow-clip');
    expect(
      region.className.split(/\s+/).filter((c) => /^overflow-(hidden|auto|scroll)$/.test(c)),
    ).toEqual([]);
  });
});

describe('AccordionTrigger — a long one-line title clips instead of widening the row', () => {
  function renderTrigger() {
    render(
      <Accordion type="single">
        <AccordionItem value="one">
          <AccordionTrigger>
            <span className="single-line-truncate">A very long section title</span>
          </AccordionTrigger>
          <AccordionContent>Body</AccordionContent>
        </AccordionItem>
      </Accordion>,
    );
    const trigger = screen.getByRole('button', { name: 'A very long section title' });
    const title = screen.getByText('A very long section title');
    return { trigger, title };
  }

  it('the header and the trigger may shrink below their content', () => {
    const { trigger } = renderTrigger();
    expect(trigger).toHaveClass('min-w-0');
    expect(trigger.parentElement).toHaveClass('flex', 'min-w-0');
  });

  it("the trigger's content takes the width beside the chevron and may shrink", () => {
    const { trigger, title } = renderTrigger();
    const content = title.parentElement;
    expect(content?.parentElement).toBe(trigger);
    expect(content).toHaveClass('min-w-0', 'flex-1');
    const chevron = trigger.querySelector(':scope > svg');
    expect(chevron).not.toBeNull();
    expect(chevron).toHaveClass('shrink-0');
    expect(trigger.lastElementChild).toBe(chevron);
  });
});
