import { promises as fs } from 'fs'
import { join } from 'path'
import { load } from 'cheerio'

async function findContent() {
  const testDataDir = join(__dirname, 'tests/data')
  const htmlDir = join(testDataDir, 'html')

  // Test Japanese article
  const htmlContent = await fs.readFile(join(htmlDir, 'japanese_article.html'), 'utf-8')
  
  const $ = load(htmlContent)
  
  // Search for the specific text
  const targetText = '６月12日の歴史的な米朝首脳会談'
  
  $('*').each((i, el) => {
    const text = $(el).text()
    if (text.includes(targetText)) {
      console.log(`Found in ${el.tagName}:`)
      console.log(`  ID: ${$(el).attr('id')}`)
      console.log(`  Class: ${$(el).attr('class')}`)
      console.log(`  Text length: ${text.length}`)
      console.log(`  Text preview: ${text.substring(0, 200)}...`)
      console.log(`  Parent: ${el.parent?.tagName}`)
      console.log(`  Children: ${$(el).children().length}`)
      console.log('---')
    }
  })
}

findContent().catch(console.error)