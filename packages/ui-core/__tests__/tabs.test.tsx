import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../src/components/tabs';

describe('Tabs components', () => {
  it('renders tab structure without crashing', () => {
    const { container } = render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>,
    );
    expect(container.firstChild).not.toBeNull();
  });

  it('renders TabsTrigger with children', () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">My Tab</TabsTrigger>
        </TabsList>
      </Tabs>,
    );
    expect(screen.getByText('My Tab')).toBeDefined();
  });

  it('renders active TabsContent', () => {
    render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Active Content</TabsContent>
      </Tabs>,
    );
    expect(screen.getByText('Active Content')).toBeDefined();
  });

  it('TabsList accepts className', () => {
    const { container } = render(
      <Tabs defaultValue="a">
        <TabsList className="my-tabs-list">
          <TabsTrigger value="a">A</TabsTrigger>
        </TabsList>
      </Tabs>,
    );
    const list = container.querySelector('[class*="my-tabs-list"]');
    expect(list).not.toBeNull();
  });

  it('TabsTrigger accepts className', () => {
    const { container } = render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a" className="my-trigger">A</TabsTrigger>
        </TabsList>
      </Tabs>,
    );
    const trigger = container.querySelector('[class*="my-trigger"]');
    expect(trigger).not.toBeNull();
  });

  it('TabsContent accepts className', () => {
    const { container } = render(
      <Tabs defaultValue="a">
        <TabsList>
          <TabsTrigger value="a">A</TabsTrigger>
        </TabsList>
        <TabsContent value="a" className="my-content">Content</TabsContent>
      </Tabs>,
    );
    const content = container.querySelector('[class*="my-content"]');
    expect(content).not.toBeNull();
  });

  it('TabsList has displayName', () => {
    expect(typeof TabsList.displayName).toBe('string');
  });

  it('TabsTrigger has displayName', () => {
    expect(typeof TabsTrigger.displayName).toBe('string');
  });

  it('TabsContent has displayName', () => {
    expect(typeof TabsContent.displayName).toBe('string');
  });
});
