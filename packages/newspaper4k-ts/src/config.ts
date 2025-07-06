import { ArticleConfig, NetworkConfig } from './types';

/**
 * Default configuration for article extraction
 */
export const DEFAULT_CONFIG: ArticleConfig = {
  minWordCount: 300,
  minSentCount: 7,
  maxTitle: 200,
  maxText: 100000,
  maxKeywords: 35,
  maxAuthors: 10,
  maxSummarySent: 5,
  memorizeArticles: true,
  fetchImages: true,
  followMetaRefresh: false,
  cleanArticleHtml: true,
  httpSuccessOnly: true,
  timeout: 30000,
  maxRetries: 3,
  userAgent: 'Mozilla/5.0 (compatible; Newspaper4k-TS/1.0)',
  headers: {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate',
    'Connection': 'keep-alive'
  },
  language: 'en'
};

/**
 * Network configuration defaults
 */
export const DEFAULT_NETWORK_CONFIG: NetworkConfig = {
  timeout: 30000,
  maxRetries: 3,
  retryDelay: 1000,
  userAgent: 'Mozilla/5.0 (compatible; Newspaper4k-TS/1.0)',
  headers: {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate',
    'Connection': 'keep-alive'
  },
  followRedirects: true,
  maxRedirects: 5
};

/**
 * Language-specific stopwords and configurations
 */
export const LANGUAGE_CONFIGS = {
  en: {
    stopwords: ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them'],
    sentenceEnders: ['.', '!', '?', '\n\n'],
    abbreviations: ['Mr.', 'Mrs.', 'Dr.', 'Prof.', 'Inc.', 'Ltd.', 'Co.', 'Corp.', 'etc.', 'vs.', 'i.e.', 'e.g.']
  },
  zh: {
    stopwords: ['的', '是', '在', '了', '不', '和', '有', '大', '这', '主', '为', '上', '个', '国', '我', '以', '要', '他', '时', '来', '用', '们', '生', '到', '作', '地', '于', '出', '就', '分', '对', '成', '会', '可', '主', '发', '年', '动', '同', '工', '也', '能', '下', '过', '子', '说', '产', '种', '面', '而', '方', '后', '多', '定', '行', '学', '法', '所', '民', '得', '经', '十', '三', '之', '进', '着', '等', '部', '度', '家', '电', '力', '里', '如', '水', '化', '高', '自', '二', '理', '起', '小', '物', '现', '实', '加', '量', '都', '两', '体', '制', '机', '当', '使', '点', '从', '业', '本', '去', '把', '性', '好', '应', '开', '它', '合', '还', '因', '由', '其', '些', '然', '前', '外', '天', '政', '四', '日', '那', '社', '义', '事', '平', '形', '相', '全', '表', '间', '样', '与', '关', '各', '重', '新', '线', '内', '数', '正', '心', '反', '你', '明', '看', '原', '又', '么', '利', '比', '或', '但', '质', '气', '第', '向', '道', '命', '此', '变', '条', '只', '没', '结', '解', '问', '意', '建', '月', '公', '无', '系', '军', '很', '情', '者', '最', '立', '代', '想', '已', '通', '并', '提', '直', '题', '党', '程', '展', '五', '果', '料', '象', '员', '革', '位', '入', '常', '文', '总', '次', '品', '式', '活', '设', '及', '管', '特', '件', '长', '求', '老', '头', 'è¿™', 'é‚£', 'ä¸€', 'ä¸¤', 'ä¸‰', 'å››', 'äº"', 'å…­', 'ä¸ƒ', 'å…«', 'ä¹', 'å十'],
    sentenceEnders: ['。', '！', '？', '；', '\n\n'],
    abbreviations: []
  },
  ja: {
    stopwords: ['の', 'に', 'は', 'を', 'た', 'が', 'で', 'て', 'と', 'し', 'れ', 'さ', 'ある', 'いる', 'も', 'する', 'から', 'な', 'こと', 'として', 'い', 'や', 'れる', 'など', 'なっ', 'ない', 'この', 'ため', 'その', 'あっ', 'よう', 'また', 'もの', 'という', 'あり', 'まで', 'られ', 'なる', 'へ', 'か', 'だ', 'これ', 'によって', 'により', 'おり', 'より', 'による', 'ず', 'なり', 'られる', 'において', 'ば', 'なかっ', 'なら', 'に対して'],
    sentenceEnders: ['。', '！', '？', '；', '\n\n'],
    abbreviations: []
  }
};

/**
 * HTML parsing configuration
 */
export const HTML_CONFIG = {
  // Content-rich tags (higher score)
  contentTags: ['article', 'main', 'section', 'div', 'p', 'span'],
  
  // Positive scoring tags
  positiveTags: ['article', 'main', 'content', 'entry', 'post', 'story', 'text', 'body'],
  
  // Negative scoring tags
  negativeTags: ['nav', 'aside', 'footer', 'header', 'menu', 'sidebar', 'ad', 'advertisement', 'social', 'share', 'related', 'comments', 'comment'],
  
  // Tags to completely remove
  removeTags: ['script', 'style', 'noscript', 'iframe', 'embed', 'object', 'applet'],
  
  // Image selectors
  imageSelectors: ['img', 'picture source', 'figure img'],
  
  // Video selectors
  videoSelectors: ['video', 'iframe[src*="youtube"]', 'iframe[src*="vimeo"]', 'iframe[src*="dailymotion"]'],
  
  // Author selectors
  authorSelectors: [
    '[rel="author"]',
    '[class*="author"]',
    '[class*="byline"]',
    '[class*="writer"]',
    '[itemprop="author"]',
    'meta[name="author"]'
  ],
  
  // Date selectors
  dateSelectors: [
    'time[datetime]',
    '[class*="date"]',
    '[class*="time"]',
    '[class*="published"]',
    '[itemprop="datePublished"]',
    '[itemprop="dateCreated"]',
    'meta[property="article:published_time"]',
    'meta[name="date"]'
  ]
};

/**
 * Scoring weights for content extraction
 */
export const SCORING_CONFIG = {
  // Content scoring weights
  textLengthWeight: 1.0,
  paragraphCountWeight: 2.0,
  stopwordRatioWeight: 1.5,
  linkDensityWeight: -2.0,
  
  // Tag scoring multipliers
  articleTag: 3.0,
  mainTag: 2.5,
  contentTag: 2.0,
  entryTag: 1.5,
  postTag: 1.5,
  storyTag: 1.5,
  
  // Negative scoring multipliers
  navTag: -2.0,
  asideTag: -1.5,
  footerTag: -1.5,
  headerTag: -1.0,
  menuTag: -1.5,
  sidebarTag: -2.0,
  adTag: -3.0,
  
  // Link density penalties
  maxLinkDensity: 0.3,
  linkDensityPenalty: -5.0,
  
  // Minimum thresholds
  minTextLength: 50,
  minParagraphCount: 2,
  minStopwordRatio: 0.1
};