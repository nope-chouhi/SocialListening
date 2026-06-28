/**
 * Shared utilities for mentions
 */

export interface SourceLabelMention {
  author?: string | null;
  source_name?: string | null;
  domain?: string | null;
  url?: string | null;
  original_url?: string | null;
  permalink?: string | null;
  source_url?: string | null;
  source_type?: string | null;
}

export function getMentionSourceLabel(mention: SourceLabelMention): string {
  if (mention.author && mention.author.trim() !== '') return mention.author.trim();
  if (mention.source_name && mention.source_name.trim() !== '') return mention.source_name.trim();
  if (mention.domain && mention.domain.trim() !== '') return mention.domain.trim();

  const anyUrl = mention.url || mention.original_url || mention.permalink || mention.source_url;
  if (anyUrl) {
    try {
      const url = new URL(anyUrl);
      const domainFromUrl = url.hostname.replace(/^www\./, '');
      if (domainFromUrl) return domainFromUrl;
    } catch (e) {
      // Ignore invalid URL
    }
  }

  if (mention.source_type) {
    const st = mention.source_type.toLowerCase();
    if (st === 'video' || st === 'youtube' || st === 'yt' || st === 'youtube_video' || st === 'youtube_channel') return 'YouTube';
    if (st === 'news' || st === 'newspaper' || st === 'article_news') return 'News';
    if (st === 'web' || st === 'website' || st === 'article' || st === 'global_search') return 'Web';
    if (st === 'blog' || st === 'forum' || st === 'blogs_forums' || st === 'blogs/forums') return 'Blog/Forum';
    if (st === 'rss' || st === 'feed' || st === 'rss_feed') return 'RSS';
    if (st === 'facebook' || st === 'facebook_page' || st === 'facebook_group' || st === 'facebook_profile') return 'Facebook';
    if (st === 'instagram' || st === 'instagram_business') return 'Instagram';
    if (st === 'tiktok') return 'TikTok';
    // Fallback: title case the raw source type
    return mention.source_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  return 'Không xác định';
}
