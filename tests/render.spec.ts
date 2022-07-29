/*
 * dimer-edge-shiki
 *
 * (c) Harminder Virk <virk@adonisjs.comharminder@cav.ai>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { test } from '@japa/runner'
import { fileURLToPath } from 'node:url'
import { MarkdownFile } from '@dimerapp/markdown'

import { ShikiRenderer, codeblocks } from '../src/renderer/index.js'

test.group('Shiki | grammar', () => {
  test('transform code blocks inside the pre tag', async ({ assert }) => {
    const markdown = [
      `Pre sample`,
      '',
      '```js',
      `const Markdown = require('@dimerapp/markdown')`,
      `const markdown = new Markdown(contents)`,
      `const tokens = await markdown.toJSON()`,
      `console.log(tokens)`,
      `/**`,
      `* { type: 'text', value: 'something' }`,
      `*/`,
      '```',
    ].join('\n')

    const shiki = new ShikiRenderer()
    await shiki.boot()

    const file = new MarkdownFile(markdown, { enableDirectives: true })
    file.transform(codeblocks, shiki)
    await file.process()

    const pre = file.ast?.children[2] as any
    assert.equal(pre.type, 'element')
    assert.equal(pre.tagName, 'pre')
    assert.deepEqual(pre.properties, {
      className: ['language-javascript'],
      dataLinesCount: 7,
      style: 'background-color: #292D3E;',
    })

    const code = pre.children[0]
    assert.equal(code.children.length, pre.properties.dataLinesCount)
  })

  test('highlight lines', async ({ assert }) => {
    const markdown = [
      `Pre sample`,
      '',
      '```js',
      `const Markdown = require('@dimerapp/markdown')`,
      `// highlight-start`,
      `const markdown = new Markdown(contents)`,
      `const tokens = await markdown.toJSON()`,
      `// highlight-end`,
      `console.log(tokens)`,
      `/**`,
      `// highlight-start`,
      `* { type: 'text', value: 'something' }`,
      `// highlight-end`,
      `*/`,
      '```',
    ].join('\n')

    const shiki = new ShikiRenderer()
    await shiki.boot()

    const file = new MarkdownFile(markdown, { enableDirectives: true })
    file.transform(codeblocks, shiki)
    await file.process()

    const pre = file.ast?.children[2] as any
    assert.equal(pre.type, 'element')
    assert.equal(pre.tagName, 'pre')
    assert.deepEqual(pre.properties, {
      className: ['language-javascript'],
      dataLinesCount: 7,
      style: 'background-color: #292D3E;',
    })

    const code = pre.children[0]
    assert.deepEqual(code.children[0].properties.className, ['line', 'dim'])
    assert.deepEqual(code.children[1].properties.className, ['line', 'highlight'])
    assert.deepEqual(code.children[2].properties.className, ['line', 'highlight'])
    assert.deepEqual(code.children[3].properties.className, ['line', 'dim'])
    assert.deepEqual(code.children[4].properties.className, ['line', 'dim'])
    assert.deepEqual(code.children[5].properties.className, ['line', 'highlight'])
    assert.deepEqual(code.children[6].properties.className, ['line', 'dim'])
  })

  test('define codeblock title', async ({ assert }) => {
    const markdown = [
      `Pre sample`,
      '',
      '```js',
      '// title: foo.js',
      `const Markdown = require('@dimerapp/markdown')`,
      `const markdown = new Markdown(contents)`,
      `const tokens = await markdown.toJSON()`,
      `console.log(tokens)`,
      `/**`,
      `* { type: 'text', value: 'something' }`,
      `*/`,
      '```',
    ].join('\n')

    const shiki = new ShikiRenderer()
    await shiki.boot()

    const file = new MarkdownFile(markdown, { enableDirectives: true })
    file.transform(codeblocks, shiki)
    await file.process()

    const pre = file.ast?.children[2] as any
    assert.equal(pre.type, 'element')
    assert.equal(pre.tagName, 'pre')
    assert.deepEqual(pre.properties, {
      className: ['language-javascript'],
      dataLinesCount: 7,
      style: 'background-color: #292D3E;',
      dataTitle: 'foo.js',
    })

    const code = pre.children[0]
    assert.deepEqual(code.children[0].properties.className, ['line'])
    assert.deepEqual(code.children[1].properties.className, ['line'])
    assert.deepEqual(code.children[2].properties.className, ['line'])
    assert.deepEqual(code.children[3].properties.className, ['line'])
    assert.deepEqual(code.children[4].properties.className, ['line'])
    assert.deepEqual(code.children[5].properties.className, ['line'])
    assert.deepEqual(code.children[6].properties.className, ['line'])
  })

  test('gracefully ignore invalid thematic block', async ({ assert }) => {
    const markdown = [
      `Pre sample`,
      '',
      '```js[foo]',
      `const Markdown = require('@dimerapp/markdown')`,
      `const markdown = new Markdown(contents)`,
      `const tokens = await markdown.toJSON()`,
      `console.log(tokens)`,
      `/**`,
      `* { type: 'text', value: 'something' }`,
      `*/`,
      '```',
    ].join('\n')

    const shiki = new ShikiRenderer()
    await shiki.boot()

    const file = new MarkdownFile(markdown, { enableDirectives: true })
    file.transform(codeblocks, shiki)
    await file.process()

    const pre = file.ast?.children[2] as any
    assert.equal(pre.type, 'element')
    assert.equal(pre.tagName, 'pre')
    assert.deepEqual(pre.properties, {
      className: ['language-text'],
      dataLinesCount: 7,
      style: 'background-color: #292D3E;',
    })

    const code = pre.children[0]
    assert.deepEqual(code.children[0].properties.className, ['line'])
    assert.deepEqual(code.children[1].properties.className, ['line'])
    assert.deepEqual(code.children[2].properties.className, ['line'])
    assert.deepEqual(code.children[3].properties.className, ['line'])
    assert.deepEqual(code.children[4].properties.className, ['line'])
    assert.deepEqual(code.children[5].properties.className, ['line'])
    assert.deepEqual(code.children[6].properties.className, ['line'])
  })

  test('highlight inserts and deletes', async ({ assert }) => {
    const markdown = [
      `Pre sample`,
      '',
      '```js',
      `const Markdown = require('@dimerapp/markdown')`,
      `// delete-start`,
      `const markdown = new Markdown({})`,
      `// delete-end`,
      `// insert-start`,
      `const markdown = new Markdown(contents)`,
      `// insert-end`,
      `const tokens = await markdown.toJSON()`,
      `console.log(tokens)`,
      `/**`,
      `// highlight-start`,
      `* { type: 'text', value: 'something' }`,
      `// highlight-end`,
      `*/`,
      '```',
    ].join('\n')

    const shiki = new ShikiRenderer()
    await shiki.boot()

    const file = new MarkdownFile(markdown, { enableDirectives: true })
    file.transform(codeblocks, shiki)
    await file.process()

    const pre = file.ast?.children[2] as any
    assert.equal(pre.type, 'element')
    assert.equal(pre.tagName, 'pre')
    assert.deepEqual(pre.properties, {
      className: ['language-javascript'],
      dataLinesCount: 8,
      style: 'background-color: #292D3E;',
    })

    const code = pre.children[0]
    assert.deepEqual(code.children[0].properties.className, ['line', 'dim'])
    assert.deepEqual(code.children[1].properties.className, ['line', 'highlight-delete'])
    assert.deepEqual(code.children[2].properties.className, ['line', 'highlight-insert'])
    assert.deepEqual(code.children[3].properties.className, ['line', 'dim'])
    assert.deepEqual(code.children[4].properties.className, ['line', 'dim'])
    assert.deepEqual(code.children[5].properties.className, ['line', 'dim'])
    assert.deepEqual(code.children[6].properties.className, ['line', 'highlight'])
  })

  test('register a custom language', async ({ assert }) => {
    const markdown = [
      `Pre sample`,
      '```ts',
      'var a = 1',
      '```',
      '',
      '```edge',
      `@set('foo', 'bar')`,
      '```',
    ].join('\n')

    const shiki = new ShikiRenderer()
    shiki.loadLanguage({
      scopeName: 'text.html.edge',
      id: 'edge',
      path: fileURLToPath(new URL('../edge.tmLanguage.json', import.meta.url)),
    })
    await shiki.boot()

    const file = new MarkdownFile(markdown, { enableDirectives: true })
    file.transform(codeblocks, shiki)
    await file.process()

    const pre = file.ast?.children[4] as any
    assert.equal(pre.type, 'element')
    assert.equal(pre.tagName, 'pre')
    assert.deepEqual(pre.properties, {
      className: ['language-edge'],
      dataLinesCount: 1,
      style: 'background-color: #292D3E;',
    })

    const code = pre.children[0]
    assert.equal(code.children.length, pre.properties.dataLinesCount)
  })
})

test.group('Shiki | plain text', () => {
  test('transform code blocks inside the pre tag', async ({ assert }) => {
    const markdown = [
      `Pre sample`,
      '',
      '```',
      `const Markdown = require('@dimerapp/markdown')`,
      `const markdown = new Markdown(contents)`,
      `const tokens = await markdown.toJSON()`,
      `console.log(tokens)`,
      `/**`,
      `* { type: 'text', value: 'something' }`,
      `*/`,
      '```',
    ].join('\n')

    const shiki = new ShikiRenderer()
    await shiki.boot()

    const file = new MarkdownFile(markdown, { enableDirectives: true })
    file.transform(codeblocks, shiki)
    await file.process()

    const pre = file.ast?.children[2] as any
    assert.equal(pre.type, 'element')
    assert.equal(pre.tagName, 'pre')
    assert.deepEqual(pre.properties, {
      className: ['language-text'],
      dataLinesCount: 7,
      style: 'background-color: #292D3E;',
    })

    const code = pre.children[0]
    assert.equal(code.children.length, pre.properties.dataLinesCount)
  })

  test('highlight lines', async ({ assert }) => {
    const markdown = [
      `Pre sample`,
      '',
      '```text',
      `const Markdown = require('@dimerapp/markdown')`,
      `// highlight-start`,
      `const markdown = new Markdown(contents)`,
      `const tokens = await markdown.toJSON()`,
      `// highlight-end`,
      `console.log(tokens)`,
      `/**`,
      `// highlight-start`,
      `* { type: 'text', value: 'something' }`,
      `// highlight-end`,
      `*/`,
      '```',
    ].join('\n')

    const shiki = new ShikiRenderer()
    await shiki.boot()

    const file = new MarkdownFile(markdown, { enableDirectives: true })
    file.transform(codeblocks, shiki)
    await file.process()

    const pre = file.ast?.children[2] as any
    assert.equal(pre.type, 'element')
    assert.equal(pre.tagName, 'pre')
    assert.deepEqual(pre.properties, {
      className: ['language-text'],
      dataLinesCount: 7,
      style: 'background-color: #292D3E;',
    })

    const code = pre.children[0]
    assert.deepEqual(code.children[0].properties.className, ['line', 'dim'])
    assert.deepEqual(code.children[1].properties.className, ['line', 'highlight'])
    assert.deepEqual(code.children[2].properties.className, ['line', 'highlight'])
    assert.deepEqual(code.children[3].properties.className, ['line', 'dim'])
    assert.deepEqual(code.children[4].properties.className, ['line', 'dim'])
    assert.deepEqual(code.children[5].properties.className, ['line', 'highlight'])
    assert.deepEqual(code.children[6].properties.className, ['line', 'dim'])
  })

  test('define codeblock title', async ({ assert }) => {
    const markdown = [
      `Pre sample`,
      '',
      '```text',
      '// title: foo.js',
      `const Markdown = require('@dimerapp/markdown')`,
      `const markdown = new Markdown(contents)`,
      `const tokens = await markdown.toJSON()`,
      `console.log(tokens)`,
      `/**`,
      `* { type: 'text', value: 'something' }`,
      `*/`,
      '```',
    ].join('\n')

    const shiki = new ShikiRenderer()
    await shiki.boot()

    const file = new MarkdownFile(markdown, { enableDirectives: true })
    file.transform(codeblocks, shiki)
    await file.process()

    const pre = file.ast?.children[2] as any
    assert.equal(pre.type, 'element')
    assert.equal(pre.tagName, 'pre')
    assert.deepEqual(pre.properties, {
      className: ['language-text'],
      dataLinesCount: 7,
      style: 'background-color: #292D3E;',
      dataTitle: 'foo.js',
    })

    const code = pre.children[0]
    assert.deepEqual(code.children[0].properties.className, ['line'])
    assert.deepEqual(code.children[1].properties.className, ['line'])
    assert.deepEqual(code.children[2].properties.className, ['line'])
    assert.deepEqual(code.children[3].properties.className, ['line'])
    assert.deepEqual(code.children[4].properties.className, ['line'])
    assert.deepEqual(code.children[5].properties.className, ['line'])
    assert.deepEqual(code.children[6].properties.className, ['line'])
  })

  test('highlight inserts and deletes', async ({ assert }) => {
    const markdown = [
      `Pre sample`,
      '',
      '```text',
      `const Markdown = require('@dimerapp/markdown')`,
      `// delete-start`,
      `const markdown = new Markdown({})`,
      `// delete-end`,
      `// insert-start`,
      `const markdown = new Markdown(contents)`,
      `// insert-end`,
      `const tokens = await markdown.toJSON()`,
      `console.log(tokens)`,
      `/**`,
      `// highlight-start`,
      `* { type: 'text', value: 'something' }`,
      `// highlight-end`,
      `*/`,
      '```',
    ].join('\n')

    const shiki = new ShikiRenderer()
    await shiki.boot()

    const file = new MarkdownFile(markdown, { enableDirectives: true })
    file.transform(codeblocks, shiki)
    await file.process()

    const pre = file.ast?.children[2] as any
    assert.equal(pre.type, 'element')
    assert.equal(pre.tagName, 'pre')
    assert.deepEqual(pre.properties, {
      className: ['language-text'],
      dataLinesCount: 8,
      style: 'background-color: #292D3E;',
    })

    const code = pre.children[0]
    assert.deepEqual(code.children[0].properties.className, ['line', 'dim'])
    assert.deepEqual(code.children[1].properties.className, ['line', 'highlight-delete'])
    assert.deepEqual(code.children[2].properties.className, ['line', 'highlight-insert'])
    assert.deepEqual(code.children[3].properties.className, ['line', 'dim'])
    assert.deepEqual(code.children[4].properties.className, ['line', 'dim'])
    assert.deepEqual(code.children[5].properties.className, ['line', 'dim'])
    assert.deepEqual(code.children[6].properties.className, ['line', 'highlight'])
  })
})

test.group('Shiki | unsupported language', () => {
  test('transform code blocks inside the pre tag', async ({ assert }) => {
    const markdown = [
      `Pre sample`,
      '',
      '```edge',
      `const Markdown = require('@dimerapp/markdown')`,
      `const markdown = new Markdown(contents)`,
      `const tokens = await markdown.toJSON()`,
      `console.log(tokens)`,
      `/**`,
      `* { type: 'text', value: 'something' }`,
      `*/`,
      '```',
    ].join('\n')

    const shiki = new ShikiRenderer()
    await shiki.boot()

    const file = new MarkdownFile(markdown, { enableDirectives: true })
    file.transform(codeblocks, shiki)
    await file.process()

    const pre = file.ast?.children[2] as any
    assert.equal(pre.type, 'element')
    assert.equal(pre.tagName, 'pre')
    assert.deepEqual(pre.properties, {
      className: ['language-text'],
      dataLinesCount: 7,
      style: 'background-color: #292D3E;',
    })

    const code = pre.children[0]
    assert.equal(code.children.length, pre.properties.dataLinesCount)
  })

  test('highlight lines using ranges', async ({ assert }) => {
    const markdown = [
      `Pre sample`,
      '',
      '```edge',
      `const Markdown = require('@dimerapp/markdown')`,
      `// highlight-start`,
      `const markdown = new Markdown(contents)`,
      `const tokens = await markdown.toJSON()`,
      `// highlight-end`,
      `console.log(tokens)`,
      `/**`,
      `// highlight-start`,
      `* { type: 'text', value: 'something' }`,
      `// highlight-end`,
      `*/`,
      '```',
    ].join('\n')

    const shiki = new ShikiRenderer()
    await shiki.boot()

    const file = new MarkdownFile(markdown, { enableDirectives: true })
    file.transform(codeblocks, shiki)
    await file.process()

    const pre = file.ast?.children[2] as any
    assert.equal(pre.type, 'element')
    assert.equal(pre.tagName, 'pre')
    assert.deepEqual(pre.properties, {
      className: ['language-text'],
      dataLinesCount: 7,
      style: 'background-color: #292D3E;',
    })

    const code = pre.children[0]
    assert.deepEqual(code.children[0].properties.className, ['line', 'dim'])
    assert.deepEqual(code.children[1].properties.className, ['line', 'highlight'])
    assert.deepEqual(code.children[2].properties.className, ['line', 'highlight'])
    assert.deepEqual(code.children[3].properties.className, ['line', 'dim'])
    assert.deepEqual(code.children[4].properties.className, ['line', 'dim'])
    assert.deepEqual(code.children[5].properties.className, ['line', 'highlight'])
    assert.deepEqual(code.children[6].properties.className, ['line', 'dim'])
  })

  test('define codeblock title', async ({ assert }) => {
    const markdown = [
      `Pre sample`,
      '',
      '```edge',
      '// title: foo.js',
      `const Markdown = require('@dimerapp/markdown')`,
      `const markdown = new Markdown(contents)`,
      `const tokens = await markdown.toJSON()`,
      `console.log(tokens)`,
      `/**`,
      `* { type: 'text', value: 'something' }`,
      `*/`,
      '```',
    ].join('\n')

    const shiki = new ShikiRenderer()
    await shiki.boot()

    const file = new MarkdownFile(markdown, { enableDirectives: true })
    file.transform(codeblocks, shiki)
    await file.process()

    const pre = file.ast?.children[2] as any
    assert.equal(pre.type, 'element')
    assert.equal(pre.tagName, 'pre')
    assert.deepEqual(pre.properties, {
      className: ['language-text'],
      dataLinesCount: 7,
      style: 'background-color: #292D3E;',
      dataTitle: 'foo.js',
    })

    const code = pre.children[0]
    assert.deepEqual(code.children[0].properties.className, ['line'])
    assert.deepEqual(code.children[1].properties.className, ['line'])
    assert.deepEqual(code.children[2].properties.className, ['line'])
    assert.deepEqual(code.children[3].properties.className, ['line'])
    assert.deepEqual(code.children[4].properties.className, ['line'])
    assert.deepEqual(code.children[5].properties.className, ['line'])
    assert.deepEqual(code.children[6].properties.className, ['line'])
  })

  test('highlight inserts and deletes', async ({ assert }) => {
    const markdown = [
      `Pre sample`,
      '',
      '```edge',
      `const Markdown = require('@dimerapp/markdown')`,
      `// delete-start`,
      `const markdown = new Markdown({})`,
      `// delete-end`,
      `// insert-start`,
      `const markdown = new Markdown(contents)`,
      `// insert-end`,
      `const tokens = await markdown.toJSON()`,
      `console.log(tokens)`,
      `/**`,
      `// highlight-start`,
      `* { type: 'text', value: 'something' }`,
      `// highlight-end`,
      `*/`,
      '```',
    ].join('\n')

    const shiki = new ShikiRenderer()
    await shiki.boot()

    const file = new MarkdownFile(markdown, { enableDirectives: true })
    file.transform(codeblocks, shiki)
    await file.process()

    const pre = file.ast?.children[2] as any
    assert.equal(pre.type, 'element')
    assert.equal(pre.tagName, 'pre')
    assert.deepEqual(pre.properties, {
      className: ['language-text'],
      dataLinesCount: 8,
      style: 'background-color: #292D3E;',
    })

    const code = pre.children[0]
    assert.deepEqual(code.children[0].properties.className, ['line', 'dim'])
    assert.deepEqual(code.children[1].properties.className, ['line', 'highlight-delete'])
    assert.deepEqual(code.children[2].properties.className, ['line', 'highlight-insert'])
    assert.deepEqual(code.children[3].properties.className, ['line', 'dim'])
    assert.deepEqual(code.children[4].properties.className, ['line', 'dim'])
    assert.deepEqual(code.children[5].properties.className, ['line', 'dim'])
    assert.deepEqual(code.children[6].properties.className, ['line', 'highlight'])
  })
})
