/*
 * @dimerapp/shiki
 *
 * (c) Harminder Virk <virk@adonisjs.comharminder@cav.ai>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { join } from 'path'
import { Parent } from 'unist'
import map from 'unist-util-map'
import { Theme, IShikiTheme } from 'shiki-themes'
import { mdastTypes, Code } from '@dimerapp/markdown'
import { ILanguageRegistration } from 'shiki-languages'
import { getHighlighter, loadTheme, getTheme, BUNDLED_LANGUAGES } from 'shiki'

type UnWrapPromise<T> = T extends PromiseLike<infer R> ? R : T

/**
 * Shiki renderer to render codeblocks using vscode themes and languages.
 */
export class ShikiRenderer {
	private themeToUse: IShikiTheme
	private shikiLanguages: ILanguageRegistration[] = []
	private highlighter?: UnWrapPromise<ReturnType<typeof getHighlighter>>

	/**
	 * An object of registered languages. We create the object since the array can be
	 * quite big and looping over all the items will take time.
	 */
	private registeredLanguagesIds = {}

	/**
	 * A mapping of alias to language. For some reason shiki is not working when
	 * passing alias directly. I can come back and dig deeper
	 */
	private languageAliases = {}

	constructor(private basePath: string) {
		BUNDLED_LANGUAGES.forEach((lang) => this.registerLanguage(lang))
	}

	/**
	 * Register the language id and aliases
	 */
	private registerLanguage(language: ILanguageRegistration) {
		this.registeredLanguagesIds[language.id] = true
		if (language.aliases) {
			language.aliases.forEach((alias) => {
				this.languageAliases[alias] = language.id
			})
		}
	}

	/**
	 * Wraps children inside the pre tag
	 */
	private wrapInsidePre(
		children: Parent[],
		lang: string,
		linesLength: number,
		fileName: string | null
	): Parent {
		return {
			type: 'element',
			name: 'pre',
			data: {
				hName: 'pre',
				hProperties: {
					className: [`language-${lang}`],
					dataLinesCount: linesLength,
					style: `background-color: ${this.themeToUse.bg};`,
					...(fileName ? { dataFileName: fileName } : {}),
				},
			},
			children: [
				{
					type: 'element',
					name: 'code',
					data: {
						hName: 'code',
						hProperties: {},
					},
					children: children,
				},
			],
		}
	}

	/**
	 * Wraps children inside a line div
	 */
	private wrapInsideLine(
		children: (Parent | mdastTypes.Text)[],
		index: number,
		meta: Code['meta'],
		hasHighlights: boolean
	): Parent {
		return {
			type: 'element',
			name: 'div',
			data: {
				hName: 'div',
				hProperties: {
					className: this.getLineClasses(index + 1, meta, hasHighlights),
				},
			},
			children: children,
		}
	}

	/**
	 * Returns the classes to the used by the code line
	 */
	private getLineClasses(line: number, meta: Code['meta'], hasHighlights: boolean) {
		if (meta.inserts.includes(line)) {
			return ['line', 'highlight-insert']
		}

		if (meta.deletes.includes(line)) {
			return ['line', 'highlight-delete']
		}

		if (meta.highlights.includes(line)) {
			return ['line', 'highlight']
		}

		return hasHighlights ? ['line', 'dim'] : ['line']
	}

	/**
	 * Returns true when language id is one of the plain text
	 * languages.
	 */
	private isPlaintext(language: string) {
		return ['plaintext', 'txt', 'text'].includes(language)
	}

	/**
	 * Use an existing theme
	 */
	public useTheme(name: Theme): this {
		this.themeToUse = getTheme(name)
		return this
	}

	/**
	 * Load a custom theme
	 */
	public loadTheme(pathToTheme: string): this {
		this.themeToUse = loadTheme(join(this.basePath, pathToTheme))
		return this
	}

	/**
	 * Load a custom language
	 */
	public loadLanguage(language: ILanguageRegistration): this {
		language.path = join(this.basePath, language.path)
		this.shikiLanguages.push(language)
		this.registerLanguage(language)
		return this
	}

	/**
	 * Boot to instantiate the highlighter. Must be done only once
	 */
	public async boot() {
		if (this.highlighter) {
			return
		}

		/**
		 * Use "material-theme-default" when no theme is defined.
		 */
		if (!this.themeToUse) {
			this.useTheme('material-theme-default')
		}

		this.highlighter = await getHighlighter({
			langs: this.shikiLanguages,
			theme: this.themeToUse,
		})
	}

	/**
	 * Render code string and get HTML back
	 */
	public render(code: string, meta: Code['meta'], hasHighlights: boolean) {
		const { lang, fileName } = meta
		let language = lang

		/**
		 * Get language for the alias
		 */
		if (language && this.languageAliases[language]) {
			language = this.languageAliases[language]
		}

		language = language || 'text'

		/**
		 * Render as text when language is not registered. Otherwise shiki will
		 * raise an error
		 */
		if (!this.registeredLanguagesIds[language]) {
			language = 'text'
		}

		/**
		 * Plain text languages cannot be tokenized and hence we have
		 * to render them as it is
		 */
		if (this.isPlaintext(language)) {
			const lines = code.split('\n')

			/**
			 * Each line is wrapped inside its own div, allowing line highlights to
			 * work seamlessly
			 */
			const tokens = lines.map((line, index) => {
				return this.wrapInsideLine(
					[
						{
							type: 'element',
							name: 'span',
							data: {
								hName: 'span',
								hProperties: {
									style: `color: ${this.themeToUse.fg};`,
								},
							},
							children: [
								{
									type: 'text',
									value: line,
								},
							],
						},
					],
					index,
					meta,
					hasHighlights
				)
			})

			return this.wrapInsidePre(tokens, 'text', lines.length, fileName)
		}

		/**
		 * Tokenize code
		 */
		const shikiTokens = this.highlighter!.codeToThemedTokens(code, language, {
			includeExplanation: false,
		})!

		/**
		 * Converting shiki tokens to mhast tokens
		 */
		const tokens = shikiTokens.map((group, index) => {
			const spans = group.map((token) => {
				return {
					type: 'element',
					name: 'span',
					data: {
						hName: 'span',
						hProperties: {
							style: `color: ${token.color || this.themeToUse.fg};`,
						},
					},
					children: [
						{
							type: 'text',
							value: token.content,
						},
					],
				}
			})

			return this.wrapInsideLine(spans, index, meta, hasHighlights)
		})

		return this.wrapInsidePre(tokens, language, shikiTokens.length, fileName)
	}

	/**
	 * Dimer markdown transform function
	 */
	public transform = function transform() {
		return (tree: mdastTypes.Content) => {
			return map(tree, (node: Code) => {
				if (node.type !== 'code') {
					return node
				}

				const hasHighlights =
					node.meta.highlights.length || node.meta.inserts.length || node.meta.deletes.length

				/**
				 * Render plain text to code
				 */
				return this.render(node.value, node.meta, hasHighlights)
			})
		}
	}.bind(this)
}
