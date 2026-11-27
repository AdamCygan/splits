import type { TaskTypeInput } from '#/features/task-types/data/dto'

export const blankType = (titleLabel: string): TaskTypeInput => ({
  name: '',
  color: '#8B5CF6',
  titleLabel,
  linkRequirement: 'optional',
  linkLabel: 'Link',
  descriptionRequirement: 'optional',
  storyPointsRequirement: 'optional',
  defaultStoryPoints: null,
  defaultTimeInput: 'duration',
  countsAsFocusWork: true,
})
