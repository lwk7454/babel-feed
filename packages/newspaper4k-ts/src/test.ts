/**
 * Basic test script for newspaper4k-ts
 */

import { Article, article, fulltext } from './index';

async function testArticleExtraction() {
  console.log('Testing newspaper4k-ts...\n');

  // Test URLs
  const testUrls = [
    'https://www.bbc.com/news/world-europe-67240404',
    'https://www.cnn.com/2023/11/01/us/space-station-crew-returns-earth/index.html',
    'https://www.theguardian.com/technology/2023/nov/01/ai-safety-summit-uk-declaration'
  ];

  for (const url of testUrls) {
    try {
      console.log(`Testing URL: ${url}`);
      
      // Test the shortcut function
      const articleInstance = await article(url, 'en');
      
      console.log(`Title: ${articleInstance.title}`);
      console.log(`Authors: ${articleInstance.authors.join(', ')}`);
      console.log(`Published: ${articleInstance.publishDate}`);
      console.log(`Language: ${articleInstance.language}`);
      console.log(`Text length: ${articleInstance.text.length} characters`);
      console.log(`Summary: ${articleInstance.summary.substring(0, 200)}...`);
      console.log(`Keywords: ${articleInstance.keywords.slice(0, 10).join(', ')}`);
      console.log(`Images: ${articleInstance.images.length}`);
      console.log(`Videos: ${articleInstance.movies.length}`);
      console.log(`Valid article: ${articleInstance.isValidArticle()}`);
      
      const stats = articleInstance.getStats();
      console.log(`Stats:`, stats);
      
      console.log('✅ Test passed\n');
      
    } catch (error) {
      console.error(`❌ Test failed for ${url}:`, error);
      console.log('');
    }
  }
}

async function testFulltextExtraction() {
  console.log('Testing fulltext extraction...\n');
  
  const sampleHtml = `
    <html>
      <head>
        <title>Sample News Article</title>
        <meta name="description" content="This is a sample article for testing">
        <meta name="author" content="John Doe">
      </head>
      <body>
        <nav>Navigation menu</nav>
        <article>
          <h1>Breaking News: Technology Advances</h1>
          <p>This is the first paragraph of the article with important information.</p>
          <p>This is the second paragraph with more details about the story.</p>
          <p>And this is the third paragraph concluding the article.</p>
        </article>
        <aside>Sidebar content</aside>
        <footer>Footer content</footer>
      </body>
    </html>
  `;
  
  try {
    const extractedText = await fulltext(sampleHtml, 'en');
    console.log('Extracted text:', extractedText);
    console.log('✅ Fulltext extraction test passed\n');
  } catch (error) {
    console.error('❌ Fulltext extraction test failed:', error);
  }
}

async function testDirectArticleClass() {
  console.log('Testing Article class directly...\n');
  
  try {
    const url = 'https://www.bbc.com/news';
    const articleInstance = new Article(url, {
      language: 'en',
      maxKeywords: 20,
      maxSummarySent: 3
    });
    
    await articleInstance.download();
    console.log('✅ Download completed');
    
    await articleInstance.parse();
    console.log('✅ Parsing completed');
    
    console.log(`Title: ${articleInstance.title}`);
    console.log(`Text length: ${articleInstance.text.length}`);
    console.log(`Language detected: ${articleInstance.language}`);
    console.log(`Keywords found: ${articleInstance.keywords.length}`);
    
    const result = articleInstance.getExtractionResult();
    console.log('Extraction result keys:', Object.keys(result));
    
    console.log('✅ Direct Article class test passed\n');
    
  } catch (error) {
    console.error('❌ Direct Article class test failed:', error);
  }
}

// Run tests
async function runTests() {
  try {
    await testFulltextExtraction();
    await testDirectArticleClass();
    await testArticleExtraction();
    
    console.log('🎉 All tests completed!');
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
}

// Export for use in other test files
export { testArticleExtraction, testFulltextExtraction, testDirectArticleClass };

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}