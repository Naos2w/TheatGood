import { mkdirSync, writeFileSync } from 'node:fs'
import { z } from 'zod'
import { auditoriumSchema } from '../src/features/auditoriums/schema.ts'

const destination = 'public/schemas/auditorium-v1.schema.json'
mkdirSync('public/schemas', { recursive: true })
writeFileSync(destination, JSON.stringify(z.toJSONSchema(auditoriumSchema), null, 2) + '\n')
