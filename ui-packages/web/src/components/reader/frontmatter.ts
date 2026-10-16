import type { Pair, ParsedNode } from 'yaml'
import { isAlias, isMap, isScalar, isSeq, parseDocument } from 'yaml'

export type MarkdownValue =
  | { readonly kind: 'scalar'; readonly value: string | number | boolean | null }
  | { readonly kind: 'mapping'; readonly properties: readonly MarkdownProperty[] }
  | { readonly kind: 'sequence'; readonly items: readonly MarkdownValue[] }
  | { readonly kind: 'alias'; readonly raw: string }

export type MarkdownProperty = {
  readonly name: string
  readonly value: MarkdownValue
}

export type MarkdownFrontmatter =
  | {
      readonly status: 'valid'
      readonly raw: string
      readonly properties: readonly MarkdownProperty[]
    }
  | { readonly status: 'invalid'; readonly raw: string; readonly message: string }

export type ParsedMarkdownDocument = {
  readonly body: string
  readonly frontmatter: MarkdownFrontmatter | null
}

const propertiesOf = (
  pairs: readonly Pair<ParsedNode, ParsedNode | null>[],
  raw: string,
): readonly MarkdownProperty[] | null => {
  const properties = pairs.map(({ key, value }) => {
    if (!isScalar(key) || typeof key.value !== 'string') return null
    const parsed = parseValue(value, raw)
    return parsed === null ? null : { name: key.value, value: parsed }
  })
  return properties.every(property => property !== null) ? properties : null
}

const parseValue = (node: ParsedNode | null, raw: string): MarkdownValue | null => {
  if (node === null || isScalar(node)) {
    const value: unknown = node === null ? null : node.value
    return value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
      ? { kind: 'scalar', value }
      : null
  }
  if (isAlias(node)) {
    return node.range ? { kind: 'alias', raw: raw.slice(node.range[0], node.range[1]) } : null
  }
  if (isMap<ParsedNode, ParsedNode | null>(node)) {
    const properties = propertiesOf(node.items, raw)
    return properties === null ? null : { kind: 'mapping', properties }
  }
  if (isSeq<ParsedNode | null>(node)) {
    const items = node.items.map(item => parseValue(item, raw))
    return items.every(item => item !== null) ? { kind: 'sequence', items } : null
  }
  return null
}

const parseFrontmatter = (source: string, raw: string): MarkdownFrontmatter | null => {
  const document = parseDocument(source)
  const diagnostics = [...document.errors, ...document.warnings]
  if (diagnostics.length > 0) {
    return {
      status: 'invalid',
      raw,
      message: diagnostics.map(diagnostic => diagnostic.message).join('\n'),
    }
  }
  if (document.contents === null) return null
  if (!isMap<ParsedNode, ParsedNode | null>(document.contents)) {
    return { status: 'invalid', raw, message: 'Frontmatter must be a mapping of named properties.' }
  }
  if (document.contents.items.length === 0) return null
  const properties = propertiesOf(document.contents.items, source)
  return properties === null
    ? {
        status: 'invalid',
        raw,
        message: 'Frontmatter contains an unsupported property. Property names must be strings.',
      }
    : { status: 'valid', raw, properties }
}

export const parseMarkdownDocument = (content: string): ParsedMarkdownDocument => {
  const opening = /^\uFEFF?---\r?\n/.exec(content)
  if (!opening) return { body: content, frontmatter: null }
  const remainder = content.slice(opening[0].length)
  const closing = /^(?:---|\.\.\.)(?:\r?\n|$)/m.exec(remainder)
  if (!closing) return { body: content, frontmatter: null }
  const end = closing.index + closing[0].length
  return {
    body: remainder.slice(end),
    frontmatter: parseFrontmatter(
      remainder.slice(0, closing.index),
      content.slice(0, opening[0].length + end),
    ),
  }
}
