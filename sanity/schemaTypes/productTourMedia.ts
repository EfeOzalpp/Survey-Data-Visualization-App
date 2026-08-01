import type {Rule} from 'sanity'

interface MediaRow {
  slideKey?: string
}

const SLIDES = [
  {title: '01 - Shape the scenery', value: 'shape-scenery'},
  {title: '02 - Answer five questions', value: 'five-questions'},
  {title: '03 - Receive your shape', value: 'receive-shape'},
  {title: '04 - Join the collective', value: 'join-collective'},
  {title: '05 - Explore shared patterns', value: 'shared-patterns'},
  {title: '06 - Watch the picture change', value: 'live-changes'},
]

function hasUniqueSlideKeys(value: unknown): true | string {
  if (!Array.isArray(value)) return true
  const keys = value
    .map((row) => (row as MediaRow | undefined)?.slideKey)
    .filter((key): key is string => typeof key === 'string')

  return new Set(keys).size === keys.length ? true : 'Each slide can appear only once'
}

export default {
  name: 'productTourMedia',
  title: 'Product Tour Media',
  type: 'document',
  fields: [
    {
      name: 'title',
      title: 'Internal Name',
      type: 'string',
      initialValue: 'Onboarding Product Tour',
      validation: (rule: Rule) => rule.required(),
    },
    {
      name: 'slides',
      title: 'Slide Media',
      type: 'array',
      validation: (rule: Rule) =>
        rule.required().min(1).max(SLIDES.length).custom(hasUniqueSlideKeys),
      of: [
        {
          name: 'productTourMediaRow',
          title: 'Slide Media',
          type: 'object',
          fields: [
            {
              name: 'slideKey',
              title: 'Slide',
              type: 'string',
              options: {list: SLIDES},
              validation: (rule: Rule) => rule.required(),
            },
            {
              name: 'lightGif',
              title: 'Light Mode GIF',
              type: 'file',
              options: {accept: 'image/gif'},
              validation: (rule: Rule) => rule.required(),
            },
            {
              name: 'darkGif',
              title: 'Dark Mode GIF',
              type: 'file',
              options: {accept: 'image/gif'},
              validation: (rule: Rule) => rule.required(),
            },
            {
              name: 'alt',
              title: 'GIF Alt Text',
              description: 'One description shared by the light and dark versions.',
              type: 'string',
              validation: (rule: Rule) => rule.required().max(240),
            },
          ],
          preview: {
            select: {title: 'slideKey', subtitle: 'alt'},
          },
        },
      ],
    },
    {name: 'enabled', title: 'Enabled', type: 'boolean', initialValue: true},
  ],
  preview: {
    select: {title: 'title'},
  },
}
