export const INTERNAL_EMAIL_DOMAINS = [
  'fittio.co.jp',
  'gra-m.com',
  'withwork.co.jp',
  'cross-c.co.jp',
  'propworks.co.jp',
  'cross-m.co.jp',
  'cm-group.co.jp',
  'shoppers-eye.co.jp',
  'd-and-m.co.jp',
  'medi-l.com',
  'metasite.co.jp',
  'infidex.co.jp',
  'excrie.co.jp',
  'alternaex.co.jp',
  'cmg.traffics.jp',
  'tokyogets.com',
  'pathcrie.co.jp',
  'reech.co.jp',
] as const

export type InternalEmailDomain = typeof INTERNAL_EMAIL_DOMAINS[number]
