/*
 * dimer-edge-shiki
 *
 * (c) Harminder Virk <virk@adonisjs.comharminder@cav.ai>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import test from 'japa'
import { MarkdownFile } from '@dimerapp/markdown'
import { ShikiRenderer } from '../src/Renderer'

test.group('ShikiRenderer', () => {
	test('render codeblocks using shiki', async (assert) => {
		const codeblock = [
			`const Markdown = require('@dimerapp/markdown')`,
			`const markdown = new Markdown(contents)`,
			`const tokens = await markdown.toJSON()`,
			`console.log(tokens)`,
			`/**`,
			`* { type: 'text', value: 'something' }`,
			`*/`,
		].join('\n')

		const shiki = new ShikiRenderer(__dirname)
		await shiki.boot()

		const { code, lang } = shiki.render(codeblock, 'javascript')
		assert.equal(lang, 'javascript')
		assert.isTrue(code.includes('<div class="line"'))
	})

	test('highlight mentioned line ranges', async (assert) => {
		const codeblock = [
			`const Markdown = require('@dimerapp/markdown')`,
			`const markdown = new Markdown(contents)`,
			`const tokens = await markdown.toJSON()`,
			`console.log(tokens)`,
			`/**`,
			`* { type: 'text', value: 'something' }`,
			`*/`,
		].join('\n')

		const shiki = new ShikiRenderer(__dirname)
		await shiki.boot()

		const { code } = shiki.render(codeblock, 'javascript', [1, 2, 3, 5])

		const lines = code.split('class="line')
		assert.isTrue(lines[1].startsWith(' highlight'))
		assert.isTrue(lines[2].startsWith(' highlight'))
		assert.isTrue(lines[3].startsWith(' highlight'))
		assert.isTrue(lines[4].startsWith(' dim'))
		assert.isTrue(lines[5].startsWith(' highlight'))
	})

	test('ignore plain text codeblocks', async (assert) => {
		const codeblock = [
			`const Markdown = require('@dimerapp/markdown')`,
			`const markdown = new Markdown(contents)`,
			`const tokens = await markdown.toJSON()`,
			`console.log(tokens)`,
			`/**`,
			`* { type: 'text', value: 'something' }`,
			`*/`,
		].join('\n')

		const shiki = new ShikiRenderer(__dirname)
		await shiki.boot()

		const { code, lang } = shiki.render(codeblock)
		assert.equal(lang, 'text')
		assert.isTrue(code.includes('<div class="line"'))
	})

	test('ignore codeblocks for un-registered languages', async (assert) => {
		const codeblock = ['```edge', '{{ username }}', '```'].join('\n')

		const shiki = new ShikiRenderer(__dirname)
		await shiki.boot()

		const { code, lang } = shiki.render(codeblock, 'edge')
		assert.equal(lang, 'text')
		assert.isTrue(code.includes('<div class="line"'))
	})
})

test.group('Shiki transform', () => {
	test('transform code blocks inside the pre tag', async (assert) => {
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

		const shiki = new ShikiRenderer(__dirname)
		await shiki.boot()

		const file = new MarkdownFile(markdown, {})
		file.transform(shiki.transform)
		await file.process()

		assert.isTrue(
			(file.ast!.children[2] as any).children[0].children[0].value.includes('<div class="line"')
		)
	})

	test('allow line highlights as ranges', async (assert) => {
		const markdown = [
			`Pre sample`,
			'',
			'```js{1-3,6}',
			`const Markdown = require('@dimerapp/markdown')`,
			`const markdown = new Markdown(contents)`,
			`const tokens = await markdown.toJSON()`,
			`console.log(tokens)`,
			`/**`,
			`* { type: 'text', value: 'something' }`,
			`*/`,
			'```',
		].join('\n')

		const shiki = new ShikiRenderer(__dirname)
		await shiki.boot()

		const file = new MarkdownFile(markdown, {})
		file.transform(shiki.transform)
		await file.process()

		const code = (file.ast!.children[2] as any).children[0].children[0].value
		const lines = code.split('class="line')

		assert.isTrue(lines[1].startsWith(' highlight'))
		assert.isTrue(lines[2].startsWith(' highlight'))
		assert.isTrue(lines[3].startsWith(' highlight'))
		assert.isTrue(lines[4].startsWith(' dim'))
		assert.isTrue(lines[5].startsWith(' dim'))
		assert.isTrue(lines[6].startsWith(' highlight'))
	})

	test('ignore when thematic block is invalid', async (assert) => {
		const markdown = [
			`Pre sample`,
			'',
			'```js[higlight="1,3"]',
			`const Markdown = require('@dimerapp/markdown')`,
			`const markdown = new Markdown(contents)`,
			`const tokens = await markdown.toJSON()`,
			`console.log(tokens)`,
			`/**`,
			`* { type: 'text', value: 'something' }`,
			`*/`,
			'```',
		].join('\n')

		const shiki = new ShikiRenderer(__dirname)
		await shiki.boot()

		const file = new MarkdownFile(markdown, {})
		file.transform(shiki.transform)
		await file.process()

		const code = file.ast!.children[2]
		assert.deepEqual((code.properties as any).className, ['dimer-highlight', 'language-text'])
	})

	test('ignore when ranges are not defined properly', async (assert) => {
		const markdown = [
			`Pre sample`,
			'',
			'```js{foo-bar}',
			`const Markdown = require('@dimerapp/markdown')`,
			`const markdown = new Markdown(contents)`,
			`const tokens = await markdown.toJSON()`,
			`console.log(tokens)`,
			`/**`,
			`* { type: 'text', value: 'something' }`,
			`*/`,
			'```',
		].join('\n')

		const shiki = new ShikiRenderer(__dirname)
		await shiki.boot()

		const file = new MarkdownFile(markdown, {})
		file.transform(shiki.transform)
		await file.process()

		const code = (file.ast!.children[2] as any).children[0].children[0].value
		const lines = code.split('class="line')

		assert.isTrue(lines[1].startsWith(' dim'))
		assert.isTrue(lines[2].startsWith(' dim'))
		assert.isTrue(lines[3].startsWith(' dim'))
		assert.isTrue(lines[4].startsWith(' dim'))
		assert.isTrue(lines[5].startsWith(' dim'))
		assert.isTrue(lines[6].startsWith(' dim'))
	})

	test('allow defining the filename', async (assert) => {
		const markdown = [
			`Pre sample`,
			'',
			'```js{}{foo.js}',
			`const Markdown = require('@dimerapp/markdown')`,
			`const markdown = new Markdown(contents)`,
			`const tokens = await markdown.toJSON()`,
			`console.log(tokens)`,
			`/**`,
			`* { type: 'text', value: 'something' }`,
			`*/`,
			'```',
		].join('\n')

		const shiki = new ShikiRenderer(__dirname)
		await shiki.boot()

		const file = new MarkdownFile(markdown, {})
		file.transform(shiki.transform)
		await file.process()

		const code = file.ast!.children[2] as any
		assert.equal(code.properties.dataFile, 'foo.js')
	})
})
