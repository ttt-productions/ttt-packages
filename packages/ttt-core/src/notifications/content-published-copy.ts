import type { HallSubItemType } from '../doc-schemas/content.js';

export type ContentPublishedNotificationType =
  'followed_content_published' | 'member_content_published';

export interface ContentPublishedCopy {
  readonly title: string;
  readonly message: string;
}

function pluralMessage(type: ContentPublishedNotificationType, count: number): string {
  return type === 'followed_content_published'
    ? `${count} new items published`
    : `${count} of your items were published to the Hall Library`;
}

export function contentPublishedStoredCopy(args: {
  readonly type: ContentPublishedNotificationType;
  readonly count: number;
  readonly hallSubItemType: HallSubItemType;
}): ContentPublishedCopy {
  const { type, count, hallSubItemType } = args;
  if (type === 'followed_content_published') {
    return {
      title: 'New in the Hall Library',
      message: count > 1 ? pluralMessage(type, count) : `A new ${hallSubItemType} was published`,
    };
  }
  return {
    title: 'Your work was published',
    message:
      count > 1
        ? pluralMessage(type, count)
        : `A new ${hallSubItemType} is now in the Hall Library`,
  };
}

export function contentPublishedNotificationCopy(args: {
  readonly type: ContentPublishedNotificationType;
  readonly count: number;
  readonly workTitle: string;
  readonly subItemTitle: string;
}): ContentPublishedCopy {
  const { type, count, workTitle, subItemTitle } = args;
  if (type === 'followed_content_published') {
    return {
      title: `New in ${workTitle}`,
      message: count > 1 ? pluralMessage(type, count) : `"${subItemTitle}" was published`,
    };
  }
  return {
    title: `Your work "${workTitle}" was published`,
    message:
      count > 1 ? pluralMessage(type, count) : `"${subItemTitle}" is now in the Hall Library`,
  };
}
