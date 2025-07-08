/**
 * Article class - Core class for news article processing
 * Port of newspaper4k Article class
 */

import { Configuration } from './configuration'
import { ArticleMetadata, ExtractionResult, DownloadState, ParseState } from './types'
import { getHtml } from './network.js'
import { ContentExtractor } from './extractors/content-extractor.js'

export class Article {
  private _url: string
  private _config: Configuration
  private _html = ''
  private _cleanedHtml = ''
  private _text = ''
  private _metadata: ArticleMetadata = {}
  private _downloadState: DownloadState = DownloadState.NOT_STARTED
  private _parseState: ParseState = ParseState.NOT_STARTED
  private _isDownloaded = false
  private _isParsed = false

  constructor(url: string, config?: Configuration) {
    this._url = url
    this._config = config || new Configuration()
  }

  /**
   * Download article from URL
   */
  async download(): Promise<void> {
    this._downloadState = DownloadState.STARTED
    try {
      this._html = await getHtml(this._url, this._config)
      this._downloadState = DownloadState.SUCCESS
      this._isDownloaded = true
    } catch (error) {
      this._downloadState = DownloadState.FAILED
      throw error
    }
  }

  /**
   * Parse downloaded HTML content
   */
  async parse(): Promise<void> {
    if (!this._isDownloaded) {
      throw new Error('Article must be downloaded before parsing')
    }

    this._parseState = ParseState.STARTED
    try {
      const extractor = new ContentExtractor(this._config)
      const result = extractor.extractContent(this._url, this._html)
      
      this._text = result.text
      this._metadata = result.metadata
      this._cleanedHtml = result.cleanedHtml || this._html
      
      this._parseState = ParseState.SUCCESS
      this._isParsed = true
    } catch (error) {
      this._parseState = ParseState.FAILED
      throw error
    }
  }

  /**
   * Download and parse article in one step
   */
  async process(): Promise<ExtractionResult> {
    await this.download()
    await this.parse()
    return this.getResult()
  }

  /**
   * Get extraction result
   */
  getResult(): ExtractionResult {
    return {
      title: this._metadata.title || '',
      text: this._text,
      authors: this._metadata.authors || [],
      publishDate: this._metadata.publishDate || null,
      metadata: this._metadata,
      images: this._metadata.images || [],
      videos: this._metadata.videos || [],
      topNode: null,
      html: this._html,
      cleanedHtml: this._cleanedHtml,
      downloadState: this._downloadState,
      parseState: this._parseState
    }
  }

  // Getters for article properties
  get url(): string { return this._url }
  get html(): string { return this._html }
  get cleanedHtml(): string { return this._cleanedHtml }
  get text(): string { return this._text }
  get title(): string | undefined { return this._metadata.title }
  get authors(): string[] | undefined { return this._metadata.authors }
  get publishDate(): Date | undefined { return this._metadata.publishDate }
  get topImage(): string | undefined { return this._metadata.topImage }
  get images(): string[] | undefined { return this._metadata.images }
  get videos(): string[] | undefined { return this._metadata.videos }
  // NOTE: keywords and summary getters removed - not extracted by this package
  get metadata(): ArticleMetadata { return this._metadata }
  get isDownloaded(): boolean { return this._isDownloaded }
  get isParsed(): boolean { return this._isParsed }
  get downloadState(): DownloadState { return this._downloadState }
  get parseState(): ParseState { return this._parseState }
  get config(): Configuration { return this._config }

  // Setters for testing and manual content injection
  set html(html: string) { this._html = html }
  set text(text: string) { this._text = text }
  set metadata(metadata: ArticleMetadata) { this._metadata = metadata }
}