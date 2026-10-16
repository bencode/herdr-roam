import { describe, expect, it } from 'vitest'
import { parseMarkdownDocument } from './frontmatter'

const scalar = (value: string | number | boolean | null) => ({ kind: 'scalar', value })

describe('parseMarkdownDocument', () => {
  it('preserves field order, nested source values and the complete original header', () => {
    const raw =
      "---\nschema_version: 1\nid: DT-20261015-010\ncreated_at: '2026-10-15T07:01:02.495184Z'\nsources:\n- kind: mention\n  group: 软件工厂-测试\n  message_id: msgjS4M2T4Sxxai8f4z+prNIg==\n---\n"
    expect(parseMarkdownDocument(`${raw}\n# 正文\r\n`)).toEqual({
      body: '\n# 正文\r\n',
      frontmatter: {
        status: 'valid',
        raw,
        properties: [
          { name: 'schema_version', value: scalar(1) },
          { name: 'id', value: scalar('DT-20261015-010') },
          { name: 'created_at', value: scalar('2026-10-15T07:01:02.495184Z') },
          {
            name: 'sources',
            value: {
              kind: 'sequence',
              items: [
                {
                  kind: 'mapping',
                  properties: [
                    { name: 'kind', value: scalar('mention') },
                    { name: 'group', value: scalar('软件工厂-测试') },
                    { name: 'message_id', value: scalar('msgjS4M2T4Sxxai8f4z+prNIg==') },
                  ],
                },
              ],
            },
          },
        ],
      },
    })
  })

  it.each([
    ['\n', '---', ''],
    ['\r\n', '...', '\uFEFF'],
    ['\r\n', '---', ''],
    ['\n', '...', '\uFEFF'],
  ])('accepts line ending %j, closing %s and BOM %j', (newline, closing, bom) => {
    const raw = `${bom}---${newline}name: example${newline}${closing}`
    expect(parseMarkdownDocument(raw)).toEqual({
      body: '',
      frontmatter: {
        status: 'valid',
        raw,
        properties: [{ name: 'name', value: scalar('example') }],
      },
    })
  })

  it.each(['# Guide', '---\nNot a closed header', '# Guide\n---\nname: example\n---'])(
    'preserves ordinary or unclosed Markdown: %j',
    content => {
      expect(parseMarkdownDocument(content)).toEqual({ body: content, frontmatter: null })
    },
  )

  it.each(['', '# Comment only\n', '{}\n'])('omits empty property regions: %j', raw => {
    expect(parseMarkdownDocument(`---\n${raw}---\n# Guide`)).toEqual({
      body: '# Guide',
      frontmatter: null,
    })
  })

  it.each([
    'name: [unfinished\n',
    'name: first\nname: second\n',
    '- item\n',
    'just a scalar\n',
    '1: numeric key\n',
    'name: !unknown value\n',
    'nested:\n  1: numeric key\n',
  ])('preserves invalid or unsupported headers with diagnostics: %j', source => {
    const raw = `---\n${source}---\n`
    expect(parseMarkdownDocument(`${raw}# Guide`)).toEqual({
      body: '# Guide',
      frontmatter: { status: 'invalid', raw, message: expect.any(String) },
    })
  })

  it('keeps aliases as source expressions without expanding recursive references', () => {
    const raw = '---\nconfig: &config\n  self: *config\nreference: *config\n---'
    expect(parseMarkdownDocument(raw).frontmatter).toEqual({
      status: 'valid',
      raw,
      properties: [
        {
          name: 'config',
          value: {
            kind: 'mapping',
            properties: [{ name: 'self', value: { kind: 'alias', raw: '*config' } }],
          },
        },
        { name: 'reference', value: { kind: 'alias', raw: '*config' } },
      ],
    })
  })

  it('keeps numeric-looking string keys in declaration order and falsy scalar values', () => {
    const raw = '---\n"2": false\n"1": null\nempty: ""\nzero: 0\n---'
    expect(parseMarkdownDocument(raw).frontmatter).toEqual({
      status: 'valid',
      raw,
      properties: [
        { name: '2', value: scalar(false) },
        { name: '1', value: scalar(null) },
        { name: 'empty', value: scalar('') },
        { name: 'zero', value: scalar(0) },
      ],
    })
  })
})
