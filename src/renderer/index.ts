/*
 * @dimerapp/shiki
 *
 * (c) Harminder Virk <virk@adonisjs.comharminder@cav.ai>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { map } from 'unist-util-map'
import { fileURLToPath } from 'node:url'
import type {
  mdastTypes,
  Code,
  ContainerDirective,
  Directives,
  Node,
} from '@dimerapp/markdown/types'
import {
  Theme,
  loadTheme,
  IShikiTheme,
  Highlighter,
  getHighlighter,
  BUNDLED_THEMES,
  BUNDLED_LANGUAGES,
  ILanguageRegistration,
} from 'shiki'

/**
 * Shiki renderer to render codeblocks using vscode themes and languages.
 */
export class ShikiRenderer {
  /**
   * Reference to the theme to use. The value can be one of the
   * following.
   *
   * - Absolute path to a theme file.
   * - Shorthand name for a recognized theme like "material-palenight"
   * - Or the JSON blob for the theme
   */
  #theme: IShikiTheme | Theme | string = 'material-palenight'

  /**
   * A collection of custom languages to load.
   */
  #languages: ILanguageRegistration[] = []

  /**
   * Reference to shiki highlighter. It is instantiated after
   * the "boot" method call.
   */
  #highlighter?: Highlighter

  /**
   * A set of registered languages id. This allows to know the known languages
   * and fallback to text when user defined language in the codeblock is
   * not a known language.
   */
  #registeredLanguagesIds: Set<string> = new Set()

  /**
   * A map of language aliases
   */
  #languageAliases: Map<string, string> = new Map()

  constructor() {
    /**
     * Registering bundled languages. This ensures the user only need
     * to register custom languages.
     */
    for (const language of BUNDLED_LANGUAGES) {
      this.#registerLanguage(language)
    }
  }

  /**
   * Register the language id and its aliases
   */
  #registerLanguage(language: ILanguageRegistration) {
    this.#registeredLanguagesIds.add(language.id)

    for (const alias of language.aliases || []) {
      this.#languageAliases.set(alias, language.id)
    }
  }

  /**
   * Wraps children inside the pre tag
   */
  #wrapInsidePre(
    children: (mdastTypes.Content | Directives)[],
    lang: string,
    linesLength: number,
    title: string | null
  ): ContainerDirective {
    return {
      type: 'containerDirective',
      name: 'pre',
      attributes: {},
      data: {
        hName: 'pre',
        hProperties: {
          className: [`language-${lang}`],
          dataLinesCount: linesLength,
          style: `background-color: ${this.#highlighter!.getBackgroundColor()};`,
          ...(title ? { dataTitle: title } : {}),
        },
        isMacro: false,
      },
      children: [
        {
          type: 'containerDirective',
          name: 'code',
          attributes: {},
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
  #wrapInsideLine(
    children: (mdastTypes.Content | Directives)[],
    index: number,
    meta: Code['meta'],
    hasHighlights: boolean
  ): ContainerDirective {
    return {
      type: 'containerDirective',
      name: 'div',
      attributes: {},
      data: {
        isMacro: false,
        hName: 'div',
        hProperties: {
          className: this.#getLineClasses(index + 1, meta, hasHighlights),
        },
      },
      children: children.concat([{ type: 'text', value: '\n' }]),
    }
  }

  /**
   * Returns the classes to the used by the code line
   */
  #getLineClasses(line: number, meta: Code['meta'], hasHighlights: boolean) {
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
  #isPlaintext(language: string) {
    return ['plaintext', 'txt', 'text'].includes(language)
  }

  /**
   * Returns the language name from an alias
   */
  #getLanguageFromAlias(language?: string | null): string | undefined {
    if (!language) {
      return
    }

    return this.#languageAliases.get(language) || language
  }

  /**
   * Define the theme to use. The value can be one of the
   * following.
   *
   * - Absolute path to a theme file.
   * - Shorthand name for a recognized theme like "material-palenight"
   * - Or the JSON blob for the theme
   */
  useTheme(name: Theme | string | URL | IShikiTheme): this {
    this.#theme = name instanceof URL ? fileURLToPath(name) : name
    return this
  }

  /**
   * Load a custom language
   */
  loadLanguage(language: ILanguageRegistration): this {
    this.#languages.push(language)
    this.#registerLanguage(language)
    return this
  }

  /**
   * Boot to instantiate the highlighter. Calling the boot
   * method multiple times returns in a noop.
   */
  async boot() {
    if (this.#highlighter) {
      return
    }

    /**
     * Load them when it is a string and not a known bundled theme
     * shorthand name
     */
    if (typeof this.#theme === 'string') {
      if (!BUNDLED_THEMES.find((theme) => theme === this.#theme)) {
        this.#theme = await loadTheme(this.#theme)
      }
    }

    this.#highlighter = await getHighlighter({
      theme: this.#theme,
    })

    for (let language of this.#languages) {
      await this.#highlighter.loadLanguage(language)
    }
  }

  /**
   * Render code string and get HTML back
   */
  render(codeblock: Code) {
    const hasHighlights = !!(
      codeblock.meta.highlights.length ||
      codeblock.meta.inserts.length ||
      codeblock.meta.deletes.length
    )

    let language = this.#getLanguageFromAlias(codeblock.lang) || 'text'

    /**
     * Render as text when language is not recognized. Otherwise shiki will
     * raise an error
     */
    if (!this.#registeredLanguagesIds.has(language)) {
      language = 'text'
    }

    /**
     * Plain text languages cannot be tokenized and hence we have
     * to render them as it is
     */
    if (this.#isPlaintext(language)) {
      const lines = codeblock.value.split('\n')

      /**
       * Each line is wrapped inside its own div, allowing line highlights to
       * work seamlessly
       */
      const tokens = lines.map((line, index) => {
        return this.#wrapInsideLine(
          [
            {
              type: 'leafDirective',
              name: 'span',
              attributes: {},
              data: {
                hName: 'span',
                hProperties: {
                  style: `color: ${this.#highlighter!.getForegroundColor()};`,
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

      return this.#wrapInsidePre(tokens, 'text', lines.length, codeblock.meta.title)
    }

    /**
     * Tokenize code
     */
    const shikiTokens = this.#highlighter!.codeToThemedTokens(
      codeblock.value,
      language,
      undefined,
      {
        includeExplanation: false,
      }
    )!

    /**
     * Converting shiki tokens to mhast tokens
     */
    const tokens = shikiTokens.map((group, index) => {
      const spans = group.map((token) => {
        return {
          type: 'leafDirective' as const,
          name: 'span',
          attributes: {},
          data: {
            hName: 'span',
            hProperties: {
              style: `color: ${token.color || this.#highlighter!.getForegroundColor()};`,
            },
          },
          children: [
            {
              type: 'text' as const,
              value: token.content,
            },
          ],
        }
      })

      return this.#wrapInsideLine(spans, index, codeblock.meta, hasHighlights)
    })

    return this.#wrapInsidePre(tokens, language, shikiTokens.length, codeblock.meta.title)
  }
}

/**
 * Remark plugin to handle codeblocks using Shiki renderer.
 */
export function codeblocks(renderer: ShikiRenderer) {
  return (tree: Node) => {
    return map(tree, (node: Code) => {
      if (node.type !== 'code') {
        return node
      }

      /**
       * Render plain text to code
       */
      return renderer.render(node)
    })
  }
}
