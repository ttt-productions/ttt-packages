import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../src/react/components/accordion';

// The open content box clips its animation without ever being a scroll container: a hidden-overflow
// box can be scrolled by a focus or scroll-into-view mid-animation, then snaps back when it ends.
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
    expect(region.className.split(/\s+/).filter((c) => /^overflow-(hidden|auto|scroll)$/.test(c))).toEqual([]);
  });
});
