/**
 * WebView Helper
 * Focused utilities for WebView interaction and translation testing
 */

// Extend Window interface for translation bridge
declare global {
  interface Window {
    BabelTranslator?: {
      translatePage(): void;
      isTranslating(): boolean;
      getStatus(): string;
    };
  }
}

export class WebViewHelper {
  constructor(private driver: WebdriverIO.Browser) {}

  async switchToWebView(timeout = 30000): Promise<void> {
    console.log('🌐 Switching to WebView context...')
    
    await this.driver.waitUntil(
      async () => {
        const contexts = await this.driver.getContexts()
        console.log('Available contexts:', contexts)
        
        const webviewContext = contexts.find(context => {
          const contextStr = typeof context === 'string' ? context : context.id
          return contextStr.includes('WEBVIEW') && !contextStr.includes('devtools')
        })
        
        if (webviewContext) {
          const contextId = typeof webviewContext === 'string' ? webviewContext : webviewContext.id
          await this.driver.switchContext(contextId)
          console.log(`✅ Switched to WebView context: ${contextId}`)
          return true
        }
        
        return false
      },
      {
        timeout,
        timeoutMsg: `WebView context not available within ${timeout}ms`
      }
    )
  }

  async switchToNativeApp(): Promise<void> {
    console.log('📱 Switching to native app context...')
    await this.driver.switchContext('NATIVE_APP')
    console.log('✅ Switched to native app context')
  }

  async waitForPageLoad(timeout = 30000): Promise<void> {
    await this.driver.waitUntil(
      async () => {
        const readyState = await this.driver.execute(() => document.readyState)
        return readyState === 'complete'
      },
      {
        timeout,
        timeoutMsg: `Page did not load within ${timeout}ms`
      }
    )
  }

  async getPageTitle(): Promise<string> {
    return await this.driver.getTitle()
  }

  async getPageText(): Promise<string> {
    return await this.driver.execute(() => document.body.innerText)
  }

  async waitForTranslationBridge(timeout = 10000): Promise<void> {
    await this.driver.waitUntil(
      async () => {
        const hasTranslator = await this.driver.execute(() => 
          typeof window.BabelTranslator !== 'undefined'
        )
        return hasTranslator
      },
      {
        timeout,
        timeoutMsg: `Translation bridge not available within ${timeout}ms`
      }
    )
  }

  async triggerTranslation(): Promise<void> {
    console.log('🔄 Triggering translation...')
    await this.driver.execute(() => {
      if (window.BabelTranslator) {
        window.BabelTranslator.translatePage()
      }
    })
  }

  async isTranslationActive(): Promise<boolean> {
    return await this.driver.execute(() => {
      return window.BabelTranslator ? window.BabelTranslator.isTranslating() : false
    })
  }

  async getTranslationStatus(): Promise<string> {
    return await this.driver.execute(() => {
      return window.BabelTranslator ? window.BabelTranslator.getStatus() : 'unavailable'
    })
  }

  async waitForTranslationComplete(timeout = 30000): Promise<void> {
    console.log('⏳ Waiting for translation to complete...')
    
    await this.driver.waitUntil(
      async () => {
        const status = await this.getTranslationStatus()
        return status === 'completed' || status === 'error'
      },
      {
        timeout,
        timeoutMsg: `Translation did not complete within ${timeout}ms`
      }
    )
    
    console.log('✅ Translation completed')
  }

  async injectTestContent(content: string): Promise<void> {
    await this.driver.execute((htmlContent) => {
      document.body.innerHTML = htmlContent
    }, content)
  }

  async navigateToUrl(url: string): Promise<void> {
    console.log(`🔗 Navigating to: ${url}`)
    await this.driver.url(url)
    await this.waitForPageLoad()
  }
}