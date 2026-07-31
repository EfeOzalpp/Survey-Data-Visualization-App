import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './schemaTypes'

export default defineConfig({
  name: 'butterflyEffectCms',
  title: 'Butterfly Effect CMS',

  projectId: '2dnm6wwp',
  dataset: 'butterfly-habits',

  plugins: [structureTool(), visionTool()],

  schema: {
    types: schemaTypes,
  },
})
