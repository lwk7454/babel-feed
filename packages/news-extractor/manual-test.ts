import { Article } from './src/article'

const article = new Article('https://www.abc.net.au/news/2025-07-15/tobacconist-owner-hervey-bay-ordered-close-businesses-injunction/105535478')
await article.process()
console.log('Title:', article.title)
console.log('Publish Date:', article.publishDate?.toISOString())
console.log('Authors:', article.authors)
console.log('Text length:', article.text.length)