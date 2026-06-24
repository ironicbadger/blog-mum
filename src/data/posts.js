import data from './site.json';

export function isPublished(post) {
  return (post.status || 'published') === 'published';
}

export const showDrafts = import.meta.env.PUBLIC_SHOW_DRAFTS === 'true';
export const posts = showDrafts ? data.posts : data.posts.filter(isPublished);
export const siteData = {
  ...data,
  posts,
};
