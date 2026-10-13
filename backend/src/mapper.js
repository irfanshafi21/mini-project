export const toApi = (r) => ({
  id: r.id,
  code: `Q${r.id}`,
  subject: r.subject || 'GENERAL',
  unit: r.unit,
  topic: r.topic,
  subtopic: r.subtopic,
  difficulty: r.difficulty,
  marks: r.marks,
  text: r.text,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  ...(r.is_deleted ? { deletedAt: r.deleted_at } : {}),
});
