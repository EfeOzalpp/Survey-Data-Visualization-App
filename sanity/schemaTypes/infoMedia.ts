import type {Rule} from 'sanity'

// Kept in sync with INFO_SLIDES in app/src/navigation/info/slides.ts —
// the Sanity schema package can't import frontend TypeScript directly.
const SLIDES = [
  {title: '01 - Shape the scenery', value: 'shape-scenery'},
  {title: '02 - Multi-selection', value: 'multi-selection'},
  {title: '03 - Receive your shape', value: 'receive-shape'},
  {title: '04 - Join the collective', value: 'join-collective'},
  {title: '05 - Explore shared patterns', value: 'shared-patterns'},
  {title: '06 - Watch the picture change', value: 'live-changes'},
]

export default {
  name: 'infoMedia',
  title: 'Info Media',
  type: 'document',
  fields: [
    {
      name: 'slideKey',
      title: 'Slide',
      type: 'string',
      options: {list: SLIDES},
      validation: (rule: Rule) => rule.required(),
    },
    {
      name: 'lightVideo',
      title: 'Light Mode Video',
      type: 'file',
      options: {accept: 'video/webm'},
      validation: (rule: Rule) => rule.required(),
    },
    {
      name: 'lightAlt',
      title: 'Light Mode Alt Text',
      type: 'string',
      validation: (rule: Rule) => rule.required().max(240),
    },
    {
      name: 'darkVideo',
      title: 'Dark Mode Video',
      type: 'file',
      options: {accept: 'video/webm'},
      validation: (rule: Rule) => rule.required(),
    },
    {
      name: 'darkAlt',
      title: 'Dark Mode Alt Text',
      type: 'string',
      validation: (rule: Rule) => rule.required().max(240),
    },
    {name: 'enabled', title: 'Enabled', type: 'boolean', initialValue: true},
  ],
  preview: {
    select: {title: 'slideKey', subtitle: 'lightAlt'},
  },
}
