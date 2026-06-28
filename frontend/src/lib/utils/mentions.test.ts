import { getMentionSourceLabel, SourceLabelMention } from './mentions';

describe('getMentionSourceLabel', () => {
  it('returns author if available', () => {
    const mention: SourceLabelMention = { author: 'John Doe', source_name: 'News Site', domain: 'news.com' };
    expect(getMentionSourceLabel(mention)).toBe('John Doe');
  });

  it('returns source_name if author is absent', () => {
    const mention: SourceLabelMention = { author: '', source_name: 'News Site', domain: 'news.com' };
    expect(getMentionSourceLabel(mention)).toBe('News Site');
  });

  it('returns domain if author and source_name are absent', () => {
    const mention: SourceLabelMention = { author: null, source_name: null, domain: 'example.com', url: 'https://other.com' };
    expect(getMentionSourceLabel(mention)).toBe('example.com');
  });

  it('returns hostname from URL if domain is also absent', () => {
    const mention: SourceLabelMention = { url: 'https://www.youtube.com/watch?v=123' };
    expect(getMentionSourceLabel(mention)).toBe('youtube.com');
  });

  it('returns normalized source_type if URL is absent or invalid', () => {
    const mention: SourceLabelMention = { url: 'invalid-url', source_type: 'video' };
    expect(getMentionSourceLabel(mention)).toBe('YouTube');
  });

  it('title cases unknown source types', () => {
    const mention: SourceLabelMention = { source_type: 'some_new_platform' };
    expect(getMentionSourceLabel(mention)).toBe('Some New Platform');
  });

  it('returns fallback label if everything is missing', () => {
    const mention: SourceLabelMention = {};
    expect(getMentionSourceLabel(mention)).toBe('Không xác định');
  });
});
