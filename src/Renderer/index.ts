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
import rangeParser from 'parse-numeric-range'
import { mdastTypes } from '@dimerapp/markdown'
import { Theme, IShikiTheme } from 'shiki-themes'
import { ILanguageRegistration } from 'shiki-languages'
import { getHighlighter, loadTheme, getTheme, BUNDLED_LANGUAGES } from 'shiki'

type UnWrapPromise<T> = T extends PromiseLike<infer R> ? R : T

/**
 * Default response for the parseThematicBlock when no
 * lang is defined
 */
const DEFAULT_NODE = {
	lang: null,
	lineHighlights: null,
	fileName: null,
}

/**
 * Parse thematic block next to "```"
 */
function parseThematicBlock(
	lang: string
): {
	lang: null | string
	lineHighlights: null | string
	fileName: null | string
} {
	/**
	 * Language property on node is missing
	 */
	if (!lang) {
		return DEFAULT_NODE
	}

	const tokens = lang.split('{')
	const language = tokens[0].match(/^[^ \t]+(?=[ \t]|$)/)

	return {
		lang: language ? language[0] : null,
		lineHighlights: tokens[1] ? tokens[1].replace('}', '') : null,
		fileName: tokens[2] ? tokens[2].replace('}', '') : null,
	}
}

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
		fileName?: string
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
					...(fileName ? { dateFileName: fileName } : {}),
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
		highlights?: number[]
	): Parent {
		return {
			type: 'element',
			name: 'div',
			data: {
				hName: 'div',
				hProperties: {
					className: this.getLineClasses(index + 1, highlights),
				},
			},
			children: children,
		}
	}

	/**
	 * Returns the classes to the used by the code line
	 */
	private getLineClasses(line: number, highlights?: number[]) {
		if (!highlights) {
			return ['line']
		}

		return highlights.includes(line) ? ['line', 'highlight'] : ['line', 'dim']
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
	public render(code: string, language?: string, highlights?: number[], fileName?: string) {
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
					highlights
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
		 * Converting shiki tokens to mdash tokens
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

			return this.wrapInsideLine(spans, index, highlights)
		})

		return this.wrapInsidePre(tokens, language, shikiTokens.length, fileName)
	}

	/**
	 * Dimer markdown transform function
	 */
	public transform = function transform() {
		return (tree: mdastTypes.Content) => {
			return map(tree, (node) => {
				if (node.type !== 'code') {
					return node
				}

				/**
				 * Parsing the content next to "```". Which is usually
				 * "```{1-3}{filename}"
				 */
				const { lang, lineHighlights, fileName } = parseThematicBlock(node.lang as string)

				/**
				 * Convert ranges "1-3,4-6" to an array of line numbers
				 */
				const highlights = lineHighlights ? rangeParser(lineHighlights) : undefined

				/**
				 * Render plain text to code
				 */
				return this.render(
					node.value,
					lang,
					highlights && highlights.length ? highlights : undefined,
					fileName
				)
			})
		}
	}.bind(this)
}
