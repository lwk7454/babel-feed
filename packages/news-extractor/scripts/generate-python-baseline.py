#!/usr/bin/env python3
"""
Generate baseline results from Python newspaper4k for comparison testing.

This script processes the same test HTML files and generates JSON results
that our TypeScript tests can compare against.
"""

import json
import os
import sys
from pathlib import Path

# Add the Python newspaper4k to path
sys.path.insert(0, '/Users/pooh/dev/public/newspaper4k-master')

try:
    from newspaper import Article, Config
except ImportError:
    print("Error: Cannot import newspaper4k. Make sure the Python package is available.")
    sys.exit(1)

def extract_article_data(html_content: str, url: str = "http://example.com") -> dict:
    """Extract article data using Python newspaper4k"""
    
    config = Config()
    config.browser_user_agent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    config.request_timeout = 10
    config.number_threads = 1
    
    article = Article(url, config=config)
    article.html = html_content
    article.parse()
    
    # Extract all available data
    result = {
        'title': article.title,
        'authors': article.authors,
        'publish_date': article.publish_date.isoformat() if article.publish_date else None,
        'text': article.text,
        'summary': getattr(article, 'summary', ''),
        'top_image': article.top_image,
        'images': list(article.images) if hasattr(article, 'images') else [],
        'videos': list(getattr(article, 'videos', [])),
        'keywords': getattr(article, 'keywords', []),
        'meta_data': {
            'description': getattr(article, 'meta_description', ''),
            'keywords': getattr(article, 'meta_keywords', ''),
            'language': getattr(article, 'meta_lang', ''),
            'canonical': getattr(article, 'canonical_link', ''),
            'favicon': getattr(article, 'meta_favicon', ''),
        },
        'tags': getattr(article, 'tags', []),
        'url': article.url,
        'source_url': getattr(article, 'source_url', ''),
    }
    
    return result

def main():
    """Generate baseline results for all test HTML files"""
    
    # Paths
    test_data_dir = Path('/Users/pooh/dev/babel-feed/packages/news-extractor/tests/data')
    html_dir = test_data_dir / 'html'
    output_dir = test_data_dir / 'python-baseline'
    
    # Create output directory
    output_dir.mkdir(exist_ok=True)
    
    # Test files to process
    test_files = [
        'cnn_001.html',
        'time_001.html', 
        'wired_001.html',
        'chinese_article_001.html',
        'japanese_article.html',
        'video_article_01.html',
        'article_with_divs.html'
    ]
    
    results = {}
    
    for html_file in test_files:
        html_path = html_dir / html_file
        
        if not html_path.exists():
            print(f"Warning: {html_file} not found")
            continue
            
        print(f"Processing {html_file}...")
        
        try:
            with open(html_path, 'r', encoding='utf-8') as f:
                html_content = f.read()
            
            # Extract data using Python newspaper4k
            article_data = extract_article_data(html_content)
            
            # Save individual result
            output_file = output_dir / f"{html_file.replace('.html', '.json')}"
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(article_data, f, indent=2, ensure_ascii=False)
            
            results[html_file] = article_data
            print(f"✓ Processed {html_file}")
            
        except Exception as e:
            print(f"✗ Error processing {html_file}: {e}")
            continue
    
    # Save combined results
    combined_file = output_dir / 'all-results.json'
    with open(combined_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    print(f"\nGenerated baseline results for {len(results)} files")
    print(f"Results saved to: {output_dir}")
    
    # Print summary
    print("\nSummary:")
    for filename, data in results.items():
        print(f"  {filename}:")
        print(f"    Title: {data['title'][:50]}..." if data['title'] else "    Title: None")
        print(f"    Authors: {len(data['authors'])} found")
        print(f"    Text length: {len(data['text'])} chars")
        print(f"    Images: {len(data['images'])} found")
        print()

if __name__ == '__main__':
    main()