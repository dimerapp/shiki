/*
 * @dimerapp/shiki
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { map } from 'unist-util-map'
import type { Code, Node } from '@dimerapp/markdown/types'

import { Shiki } from './src/shiki/index.js'
export { Shiki }

/**
 * Remark plugin to transform codeblocks using shiki
 */
export function codeblocks(renderer: Shiki) {
  return (tree: Node) => {
    return map(tree, (node) => {
      if (node.type !== 'code') {
        return node
      }

      /**
       * Render plain text to code
       */
      return renderer.render(node as Code)
    })
  }
}
