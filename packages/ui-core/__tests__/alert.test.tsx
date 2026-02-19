import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Alert, AlertTitle, AlertDescription } from '../src/components/alert';

describe('Alert', () => {
  it('renders children', () => {
    render(<Alert>Alert content</Alert>);
    expect(screen.getByText('Alert content')).toBeInTheDocument();
  });

  it('has role="alert"', () => {
    render(<Alert>Test</Alert>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('accepts custom className', () => {
    render(<Alert className="my-alert">Test</Alert>);
    expect(screen.getByRole('alert')).toHaveClass('my-alert');
  });

  it('renders default variant', () => {
    render(<Alert>Default</Alert>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders destructive variant', () => {
    render(<Alert variant="destructive">Error!</Alert>);
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveClass('border-destructive/50');
  });
});

describe('AlertTitle', () => {
  it('renders title text', () => {
    render(<AlertTitle>Warning</AlertTitle>);
    expect(screen.getByText('Warning')).toBeInTheDocument();
  });

  it('renders as h5', () => {
    const { container } = render(<AlertTitle>Title</AlertTitle>);
    expect(container.querySelector('h5')).toBeInTheDocument();
  });

  it('accepts custom className', () => {
    const { container } = render(<AlertTitle className="title-class">T</AlertTitle>);
    expect(container.querySelector('h5')).toHaveClass('title-class');
  });
});

describe('AlertDescription', () => {
  it('renders description text', () => {
    render(<AlertDescription>This is important</AlertDescription>);
    expect(screen.getByText('This is important')).toBeInTheDocument();
  });

  it('accepts custom className', () => {
    const { container } = render(<AlertDescription className="desc-class">D</AlertDescription>);
    expect(container.firstChild).toHaveClass('desc-class');
  });
});

describe('Alert composition', () => {
  it('renders alert with title and description', () => {
    render(
      <Alert>
        <AlertTitle>Heads up!</AlertTitle>
        <AlertDescription>Something important happened.</AlertDescription>
      </Alert>
    );
    expect(screen.getByText('Heads up!')).toBeInTheDocument();
    expect(screen.getByText('Something important happened.')).toBeInTheDocument();
  });
});
