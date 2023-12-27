# Dimer Shiki
> Render markdown codeblocks using Shiki

[![gh-workflow-image]][gh-workflow-url] [![typescript-image]][typescript-url] [![npm-image]][npm-url] [![license-image]][license-url]

> **Note**: This package is ESM only

The `@dimerapp/shiki` package let you render codeblocks using the [shiki](http://shiki.matsu.io/) code highlighter, which internally uses VSCode themes and languages for transforming the code blocks.

Following are the benefits for using this package.

- Ability to use VSCode themes and languages.
- Codeblocks are converted to AST during compile phase. You do not need any frontend libraries to highlight codeblocks.
- The colors and backgrounds are picked directly from VSCode themes. Therefore, no custom CSS files are required.
- Adds custom CSS classes for [@dimerapp/markdown](https://github.com/dimerapp/markdown/tree/next#codeblock-enhancements) codeblock enhancements.

## Setup
Install the package from the npm registry as follows:

```sh
npm i @dimerapp/shiki

# yarn
yarn add @dimerapp/shiki
```

This package has a peer dependency on `@dimerapp/markdown`. So make sure to install it as well.

```sh
npm i @dimerapp/markdown

# yarn
yarn add @dimerapp/markdown
```

## Usage
Import the `Shiki` class and the `codeblocks` remark plugin to process the codeblocks inside your markdown files.

```ts
import { MarkdownFile } from '@dimerapp/markdown'
import { Shiki, codeblocks } from '@dimerapp/shiki'

const md = new MarkdownFile(content)
const shiki = new Shiki()

shiki.useTheme('nord')

/**
 * Booting shiki will load the required grammar files and themes.
 * The operation is async and must be done only once.
 */
await shiki.boot()

/**
 * Register the "codeblock" remark plugin and pass the
 * shiki instance to it.
 */
md.transform(codeblocks, shiki)

/**
 * Process markdown file
 */
await md.process()
```

## Shiki
The `Shiki` class allows you to configure shiki by using a custom theme and load custom languages.

Also, a single shiki instance can be used to process multiple markdown files.

```ts
import { Shiki } from '@dimerapp/shiki'
const shiki = new Shiki()

// 1. use theme before calling boot
// 2. load custom languages before calling boot

await shiki.boot()
```

### Using different themes
You can use different themes by calling the `useTheme` method. It accepts one of the following values.

| Type | Description |
|------|-------------|
| Shorthand name | You can define the shorthand name from one of the bundled VSCode themes. For example: `shiki.useTheme('github-dark')`. Here is the [list](https://github.com/shikijs/shiki/blob/main/docs/themes.md#all-themes) of all the shorthand names. |
| Path to JSON file | You can use custom themes by passing an absolute path to the theme JSON file.

```ts
shiki.useTheme('nord')
shiki.useTheme(new URL('./custom-theme.json', import.meta.url))
```

### Using different languages
Most of the [common languages](https://github.com/shikijs/shiki/blob/main/docs/languages.md#all-languages) are already supported by Shiki. However, you can also register custom languages by calling the `loadLanguage` method.

```ts
shiki.loadLanguage({
  scopeName: 'text.html.edge',
  id: 'edge',
  path: fileURLToPath(new URL('../edge.tmLanguage.json', import.meta.url)),  
})
```

- `scopeName`: You can find the scope name inside the grammar JSON file.
- `id`: The id to recognize the language. It is the same name you will use on the codeblocks inside markdown.
- `path`: Absolute path to the grammar JSON file.

## Codeblocks plugin
Alongside the renderer, the `codeblocks` export is the remark plugin you can register on the instance of `MarkdownFile`.

```ts
const md = new MarkdownFile(content)

/**
 * Register codeblocks plugin that uses a specific
 * rendered
 */
md.transform(codeblocks, shiki)

/**
 * Process the markdown file
 */
await md.process()
```

[gh-workflow-image]: https://img.shields.io/github/actions/workflow/status/dimerapp/shiki/test.yml?style=for-the-badge
[gh-workflow-url]: https://github.com/dimerapp/shiki/actions/workflows/test.yml 'Github action'

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: "typescript"

[npm-image]: https://img.shields.io/npm/v/@dimerapp/shiki.svg?style=for-the-badge&logo=npm
[npm-url]: https://npmjs.org/package/@dimerapp/shiki 'npm'

[license-image]: https://img.shields.io/npm/l/@dimerapp/shiki?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md 'license'
