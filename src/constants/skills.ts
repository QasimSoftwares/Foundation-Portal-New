export const skillOptions = [
  { value: 'it', label: 'IT & Software Development' } as const,
  { value: 'social_media', label: 'Social Media Management/Marketing' } as const,
  { value: 'project_management', label: 'Project Management' } as const,
  { value: 'other', label: 'Other...' } as const,
] as const;

export type SkillOption = typeof skillOptions[number]['value'];
