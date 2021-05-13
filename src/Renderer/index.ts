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
import { mdastTypes, Code } from '@dimerapp/markdown'
import {
  Theme,
  loadTheme,
  IShikiTheme,
  getHighlighter,
  BUNDLED_LANGUAGES,
  ILanguageRegistration,
} from 'shiki'

type UnWrapPromise<T> = T extends PromiseLike<infer R> ? R : T

/**
 * Shiki renderer to render codeblocks using vscode themes and languages.
 */
export class ShikiRenderer {
  /**
   * Reference to the theme to use
   */
  private themeToUse: IShikiTheme | string = 'material-theme-palenight'

  /**
   * Custom theme to load
   */
  private customThemeToLoad: string

  private shikiLanguages: ILanguageRegistration[] = ([] as ILanguageRegistration[]).concat(
    BUNDLED_LANGUAGES
  )
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
    title: string | null
  ): Parent {
    return {
      type: 'element',
      name: 'pre',
      data: {
        hName: 'pre',
        hProperties: {
          className: [`language-${lang}`],
          dataLinesCount: linesLength,
          style: `background-color: ${this.highlighter!.getBackgroundColor()};`,
          ...(title ? { dataTitle: title } : {}),
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
      children: children.concat([{ type: 'text', value: '\n' }]),
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
   * Define the define to use
   */
  public useTheme(name: Theme): this {
    this.themeToUse = name
    return this
  }

  /**
   * Load a custom theme. Calling this method will override "useTheme"
   * selection
   */
  public loadTheme(pathToTheme: string): this {
    this.customThemeToLoad = pathToTheme
    return this
  }

  /**
   * Load a custom language
   */
  public loadLanguage(language: ILanguageRegistration): this {
    if (language.path) {
      language.path = join(this.basePath, language.path)
    }

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

    if (this.customThemeToLoad) {
      this.themeToUse = await loadTheme(join(this.basePath, this.customThemeToLoad))
    }

    this.highlighter = await getHighlighter({
      langs: this.shikiLanguages,
      theme: this.themeToUse,
    })
  }

  /**
   * Render code string and get HTML back
   */
  public render(codeblock: Code) {
    const hasHighlights = !!(
      codeblock.meta.highlights.length ||
      codeblock.meta.inserts.length ||
      codeblock.meta.deletes.length
    )

    let language = codeblock.lang

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
      const lines = codeblock.value.split('\n')

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
                  style: `color: ${this.highlighter!.getForegroundColor()};`,
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
          codeblock.meta,
          hasHighlights
        )
      })

      return this.wrapInsidePre(tokens, 'text', lines.length, codeblock.meta.title)
    }

    /**
     * Tokenize code
     */
    const shikiTokens = this.highlighter!.codeToThemedTokens(codeblock.value, language, undefined, {
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
              style: `color: ${token.color || this.highlighter!.getForegroundColor()};`,
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

      return this.wrapInsideLine(spans, index, codeblock.meta, hasHighlights)
    })

    return this.wrapInsidePre(tokens, language, shikiTokens.length, codeblock.meta.title)
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

        /**
         * Render plain text to code
         */
        return this.render(node)
      })
    }
  }.bind(this)
}
