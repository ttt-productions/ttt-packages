import { describe, it, expect } from 'vitest';
import { threadDocPath, messagesColPath } from '../src/firestore/queries.js';

describe('threadDocPath', () => {
  it('appends the thread id to a string base path', () => {
    expect(threadDocPath('chats', 'thread1')).toEqual(['chats', 'thread1']);
  });

  it('appends the thread id to an array base path', () => {
    expect(threadDocPath(['entities', 'e1', 'channels'], 'thread1')).toEqual([
      'entities',
      'e1',
      'channels',
      'thread1',
    ]);
  });
});

describe('messagesColPath', () => {
  it('appends the thread and the default messages subcollection to a string base path', () => {
    expect(messagesColPath('chats', 'thread1')).toEqual(['chats', 'thread1', 'messages']);
  });

  it('appends the thread and a named subcollection to a string base path', () => {
    expect(messagesColPath('chats', 'thread1', 'messages')).toEqual([
      'chats',
      'thread1',
      'messages',
    ]);
  });

  it('appends the thread and the default messages subcollection to an array base path', () => {
    expect(messagesColPath(['entities', 'e1', 'channels'], 'thread1')).toEqual([
      'entities',
      'e1',
      'channels',
      'thread1',
      'messages',
    ]);
  });
});
