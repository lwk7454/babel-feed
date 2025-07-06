/**
 * Simple test without dependencies that might have type issues
 */

import { Article } from './article';
import { Configuration } from './configuration';

async function simpleTest() {
  console.log('Running simple test...');
  
  try {
    // Test Configuration
    const config = new Configuration({
      language: 'en',
      maxKeywords: 10,
      timeout: 5000
    });
    
    console.log('Configuration created:', config.language);
    console.log('Valid config:', config.isValid());
    
    // Test Article creation (without network calls)
    const article = new Article('https://example.com', config.toObject());
    console.log('Article created for URL:', article.url);
    console.log('Article domain:', article.sourceUrl);
    
    console.log('✅ Simple test passed');
    
  } catch (error) {
    console.error('❌ Simple test failed:', error);
  }
}

if (require.main === module) {
  simpleTest().catch(console.error);
}

export { simpleTest };