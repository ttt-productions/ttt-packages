import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Avatar, AvatarImage, AvatarFallback } from '../src/components/avatar';

describe('Avatar', () => {
  it('renders without crashing', () => {
    const { container } = render(<Avatar />);
    expect(container.firstChild).not.toBeNull();
  });

  it('accepts className and merges it', () => {
    const { container } = render(<Avatar className="my-avatar" />);
    const root = container.firstChild as HTMLElement;
    expect(root?.className).toContain('my-avatar');
  });

  it('has displayName set', () => {
    expect(typeof Avatar.displayName).toBe('string');
  });
});

describe('AvatarFallback', () => {
  it('renders children', () => {
    render(
      <Avatar>
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>,
    );
    expect(screen.getByText('AB')).toBeDefined();
  });

  it('accepts className', () => {
    const { container } = render(
      <Avatar>
        <AvatarFallback className="fallback-class">JD</AvatarFallback>
      </Avatar>,
    );
    const span = container.querySelector('[class*="fallback-class"]');
    expect(span).not.toBeNull();
  });

  it('has displayName set', () => {
    expect(typeof AvatarFallback.displayName).toBe('string');
  });
});

describe('AvatarImage', () => {
  it('returns null when src is falsy', () => {
    const { container } = render(
      <Avatar>
        <AvatarImage src="" alt="test" />
      </Avatar>,
    );
    // No img element should be rendered when src is empty string
    const img = container.querySelector('img');
    expect(img).toBeNull();
  });

  it('returns null when src is undefined', () => {
    const { container } = render(
      <Avatar>
        <AvatarImage src={undefined} alt="test" />
      </Avatar>,
    );
    const img = container.querySelector('img');
    expect(img).toBeNull();
  });

  it('has displayName set', () => {
    expect(typeof AvatarImage.displayName).toBe('string');
  });
});
