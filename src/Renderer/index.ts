/*
 * @dimerapp/shiki
 *
 * (c) Harminder Virk <virk@adonisjs.comharminder@cav.ai>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { join } from 'path'
import visit from 'unist-util-visit'
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
function parseThematicBlock(lang: string) {
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
 * Html escape sequences. Copy/pasted from
 * https://github.com/shikijs/shiki/blob/c655ea579930a92a29025b4fb1fce425b17cd947/packages/shiki/src/renderer.ts#L38
 */
const HTML_ESCAPES = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#39;',
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
				this.registeredLanguagesIds[alias] = true
			})
		}
	}

	/**
	 * Wraps code inside pre tag
	 */
	private wrapToPre(code: string, lang: string) {
		return {
			code,
			lang,
			bgColor: this.themeToUse.bg,
		}
	}

	/**
	 * Returns the classes to the used by the code line
	 */
	private getLineClasses(line: number, highlights?: number[]) {
		if (!highlights) {
			return 'line'
		}

		return highlights.includes(line) ? 'line highlight' : 'line dim'
	}

	/**
	 * Returns true when language id is one of the plain text
	 * languages.
	 */
	private isPlaintext(language: string) {
		return ['plaintext', 'txt', 'text'].includes(language)
	}

	/**
	 * Escapes html
	 */
	private escapeHtml(html: string) {
		return html.replace(/[&<>"']/g, (chr) => HTML_ESCAPES[chr])
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
	public render(code: string, language?: string, highlights?: number[]) {
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
			return this.wrapToPre(
				`<div class="line"><span style="color: ${this.themeToUse.fg}">${this.escapeHtml(
					code
				)}</span></div>`,
				'text'
			)
		}

		/**
		 * Tokenize code
		 */
		const tokens = this.highlighter!.codeToThemedTokens(code, language, {
			includeExplanation: false,
		})!

		/**
		 * Build HTML with support for line highlighting
		 */
		let html = ''
		tokens.forEach((group, index) => {
			html += `<div class="${this.getLineClasses(index + 1, highlights)}">`

			group.forEach((token) => {
				html += `<span style="color: ${token.color || this.themeToUse.fg}">${this.escapeHtml(
					token.content
				)}</span>`
			})
			html += `</div>`
		})

		return this.wrapToPre(html, language)
	}

	/**
	 * Dimer markdown transform function
	 */
	public transform = function transform() {
		return (tree: mdastTypes.Content) => {
			return visit(tree, ['code'], (node) => {
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
				const { code, lang: processedLang, bgColor } = this.render(node.value, lang, highlights)

				/**
				 * Mutate the node type to self handle the creation
				 * of `pre` tag
				 */
				node.type = 'containerDirective'
				node.name = 'pre'

				/**
				 * Define hast attributes
				 */
				node.data = node.data || {}
				node.data.hName = 'pre'
				node.data.hProperties = {
					className: ['dimer-highlight', `language-${processedLang}`],
					style: `background-color: ${bgColor}`,
					dataFile: fileName,
				}

				/**
				 * Create code and pre children
				 */
				node.data.hChildren = [
					{
						type: 'element',
						tagName: 'code',
						properties: {},
						children: [
							{
								type: 'text',
								value: code,
							},
						],
					},
				]
			})
		}
	}.bind(this)
}
