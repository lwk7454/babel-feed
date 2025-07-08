/**
 * Constants and definitions for extractors
 * Ported from Python newspaper4k defines.py
 */

export interface ArticleBodyTag {
  tag?: string
  role?: string
  class?: string
  itemprop?: string
  itemtype?: string
  score_boost: number
}

export interface MetaImageTag {
  tag: string
  attr: string
  value: string
  content: string
  score: number
}

export interface PublishDateTag {
  attribute: string
  value: string
  content: string
}

export interface MetaLanguageTag {
  tag: string
  attr: string
  value: string
}

// Score weights for gravity scoring algorithm
export const SCORE_WEIGHTS = {
  bottom_negativescore_nodes: 0.25,
  boost_score: 30,
  parent_node: 1.0,
  parent_parent_node: 0.4,
  node_count_threshold: 15,
  negative_score_threshold: 40,
  negative_score_boost: 5.0,
  boost_max_steps_from_node: 3,
  boost_min_stopword_count: 5
}

// Article body detection patterns
export const ARTICLE_BODY_TAGS: ArticleBodyTag[] = [
  { tag: 'article', role: 'article', score_boost: 25 },
  { itemprop: 'articleBody', score_boost: 100 },
  { itemprop: 'articleText', score_boost: 40 },
  { itemtype: 'https://schema.org/Article', score_boost: 30 },
  { itemtype: 'https://schema.org/NewsArticle', score_boost: 30 },
  { itemtype: 'https://schema.org/BlogPosting', score_boost: 20 },
  { itemtype: 'https://schema.org/ScholarlyArticle', score_boost: 20 },
  { itemtype: 'https://schema.org/SocialMediaPosting', score_boost: 20 },
  { itemtype: 'https://schema.org/TechArticle', score_boost: 20 },
  { class: 'paragraph|entry-content|article-text|article-body', score_boost: 15 }
]

// Author detection patterns
export const AUTHOR_ATTRS = ['name', 'rel', 'itemprop', 'class', 'id', 'property']
export const AUTHOR_VALS = [
  'author',
  'byline',
  'dc.creator',
  'byl',
  'article:author',
  'article:author_name',
  'story-byline',
  'article-author',
  'parsely-author',
  'sailthru.author',
  'citation_author'
]

export const AUTHOR_STOP_WORDS = [
  'By',
  'Reuters',
  'IANS',
  'AP',
  'AFP',
  'PTI',
  'IANS',
  'ANI',
  'DPA',
  'Senior Reporter',
  'Reporter',
  'Writer',
  'Opinion Writer'
]

// Title extraction patterns
export const TITLE_META_INFO = [
  'dc.title',
  'og:title',
  'headline',
  'articletitle',
  'article-title',
  'parsely-title',
  'title'
]

// Publication date extraction patterns
export const PUBLISH_DATE_META_INFO = [
  'published_date',
  'published_time',
  'cXenseParse:publishtime',
  'pubdate',
  'publish_date',
  'PublishDate',
  'dcterms.created',
  'rnews:datePublished',
  'article:published_time',
  'prism.publicationDate',
  'displaydate',
  'OriginalPublicationDate',
  'og:published_time',
  'datePublished',
  'article_date_original',
  'article.published',
  'published_time_telegram',
  'sailthru.date',
  'date',
  'Date',
  'original-publish-date',
  'DC.date.issued',
  'dc.date',
  'DC.Date',
  'parsely-pub-date',
  'publishtime',
  'og:regDate',
  'publication_date',
  'uploadDate',
  'coverageEndTime',
  'publishdate',
  'publish-date',
  'publishedAtDate',
  'dcterms.date',
  'publishedDate',
  'creationDateTime',
  'pub_date',
  'updated_time',
  'og:updated_time',
  'datemodified',
  'last-modified',
  'Last-Modified',
  'DC.date.modified',
  'article:modified_time',
  'modified_time',
  'modifiedDateTime',
  'dc.dcterms.modified',
  'lastmod',
  'eomportal-lastUpdate'
]

export const PUBLISH_DATE_TAGS: PublishDateTag[] = [
  { attribute: 'itemprop', value: 'datePublished', content: 'datetime' },
  { attribute: 'pubdate', value: 'pubdate', content: 'datetime' },
  { attribute: 'class', value: 'entry-date', content: 'datetime' },
  { attribute: 'class', value: 'article-date', content: 'content' },
  { attribute: 'class', value: 'postInfoDate', content: 'content' },
  { attribute: 'class', value: 'time', content: 'content' },
  { attribute: 'id', value: 'date', content: 'content' }
]

// Image extraction patterns
export const META_IMAGE_TAGS: MetaImageTag[] = [
  {
    tag: 'meta',
    attr: 'property',
    value: 'og:image',
    content: 'content',
    score: 10
  },
  {
    tag: 'link',
    attr: 'rel',
    value: 'image_src|img_src',
    content: 'href',
    score: 8
  },
  {
    tag: 'meta',
    attr: 'name',
    value: 'og:image',
    content: 'content',
    score: 8
  },
  {
    tag: 'link',
    attr: 'rel',
    value: 'icon',
    content: 'href',
    score: 5
  }
]

// Language detection patterns
export const META_LANGUAGE_TAGS: MetaLanguageTag[] = [
  { tag: 'meta', attr: 'property', value: 'og:locale' },
  { tag: 'meta', attr: 'http-equiv', value: 'content-language' },
  { tag: 'meta', attr: 'name', value: 'lang' }
]

// URL stopwords for content filtering
export const URL_STOPWORDS = [
  'about', 'academy', 'account', 'admin', 'advert', 'advertise', 'adverts',
  'archive', 'archives', 'author', 'authors', 'bebo', 'board', 'boards',
  'browse', 'career', 'careers', 'charts', 'comment', 'comments', 'contact',
  'contacts', 'coupons', 'developer', 'developers', 'donate', 'download',
  'downloads', 'edit', 'event', 'events', 'facebook', 'faq', 'faqs', 'feed',
  'feeds', 'feedback', 'flickr', 'forum', 'forums', 'friendster', 'help',
  'how-to', 'howto', 'imgur', 'info', 'itunes', 'jobs', 'legal', 'linkedin',
  'login', 'mail', 'map', 'maps', 'mobile', 'myspace', 'newsletter',
  'newsletters', 'password', 'plus', 'preference', 'preferences', 'privacy',
  'privacy-policy', 'product', 'products', 'profile', 'profiles', 'proxy',
  'purchase', 'register', 'search', 'services', 'shop', 'shopping', 'signup',
  'site-map', 'siteindex', 'sitemap', 'sitemaps', 'stop', 'store',
  'stumbleupon', 'subscribe', 'subscription', 'tag', 'terms', 'tickets',
  'toc', 'twitter', 'upload', 'uploads', 'vimeo', 'wp-admin', 'wp-includes',
  'wp-content', 'wp-json', 'wp-login', 'xmlrpc', 'xmlrpc.php', 'youtube'
]

// Category URL prefixes
export const CATEGORY_URL_PREFIXES = [
  'category', 'categories', 'topic', 'topics', 'subject', 'subjects',
  'section', 'sections', 'cat', 'cats'
]