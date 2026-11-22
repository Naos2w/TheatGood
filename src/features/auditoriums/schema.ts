import { z } from 'zod'

/**
 * A row uses audience-facing left-to-right seat numbering.
 * Distances are metres, Y increases upwards, the screen faces +Z.
 */
export const auditoriumSchema = z
  .object({
    modelVersion: z.literal(1),
    id: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string().min(1),
    cinemaName: z.string().min(1),
    format: z.string().min(1),
    description: z.string().min(1),
    confidence: z.enum(['measured', 'partial', 'estimated']),
    sources: z.array(z.url()),
    publishedSeatCount: z.number().int().nonnegative(),
    provenance: z.object({
      screenDimensions: z.enum(['official', 'estimated']),
      seatLabels: z.enum(['official', 'estimated']),
      spatialGeometry: z.enum(['official', 'estimated']),
      checkedAt: z.iso.date(),
      notes: z.string(),
    }),
    screen: z.object({
      width: z.number().positive(),
      height: z.number().positive(),
      centerX: z.number(),
      bottomY: z.number(),
      z: z.number(),
      // Optional physical tilt about the screen's horizontal centre; + tilts the top toward the audience.
      tiltDegrees: z.number().min(-30).max(30).optional(),
      // Active projected picture aspect. The physical screen can have letter/pillar boxing.
      projectionAspectRatio: z.number().positive().optional(),
    }),
    seatWidth: z.number().positive(),
    seatSpacing: z.number().positive(),
    aisleWidth: z.number().nonnegative(),
    eyeHeight: z.number().positive(),
    rows: z
      .array(
        z.object({
          // Some official Taiwanese venues use numerical rows (e.g. SPOT 1-1 through 9-9).
          label: z.string().regex(/^(?:[A-Z]+|[1-9][0-9]?)$/),
          numbers: z.array(z.number().int().positive()).min(1),
          z: z.number(),
          elevation: z.number(),
          aislesAfter: z.array(z.number().int().nonnegative()),
          xOffset: z.number().optional(),
          gapAfter: z
            .array(
              z.object({
                afterIndex: z.number().int().nonnegative(),
                width: z.number().positive(),
              }),
            )
            .optional(),
        }),
      )
      .min(1),
  })
  .superRefine((model, ctx) => {
    const labels = new Set<string>()
    const allSeatIds = new Set<string>()
    let lastZ = model.screen.z

    model.rows.forEach((row, rowIndex) => {
      if (labels.has(row.label)) {
        ctx.addIssue({ code: 'custom', path: ['rows', rowIndex, 'label'], message: '重複排號' })
      }
      labels.add(row.label)
      if (row.z <= lastZ) {
        ctx.addIssue({
          code: 'custom',
          path: ['rows', rowIndex, 'z'],
          message: '座位列必須依與銀幕距離遞增排序',
        })
      }
      lastZ = row.z

      const numbers = new Set<number>()
      row.numbers.forEach((num, index) => {
        if (numbers.has(num)) {
          ctx.addIssue({
            code: 'custom',
            path: ['rows', rowIndex, 'numbers', index],
            message: '重複座號',
          })
        }
        numbers.add(num)
        const id = `${row.label}${num}`
        if (allSeatIds.has(id)) {
          ctx.addIssue({ code: 'custom', path: ['rows', rowIndex], message: '重複座位 ID' })
        }
        allSeatIds.add(id)
      })

      const positions = [...row.aislesAfter, ...(row.gapAfter?.map((gap) => gap.afterIndex) ?? [])]
      for (const position of positions) {
        if (position >= row.numbers.length - 1) {
          ctx.addIssue({
            code: 'custom',
            path: ['rows', rowIndex],
            message: '缺口位置必須在相鄰兩座位之間',
          })
        }
      }
    })

    if (allSeatIds.size !== model.publishedSeatCount) {
      ctx.addIssue({
        code: 'custom',
        path: ['publishedSeatCount'],
        message: '座位總數與模型不一致（不含輪椅席）',
      })
    }
    if (
      (model.provenance.screenDimensions === 'official' ||
        model.provenance.seatLabels === 'official') &&
      model.sources.length === 0
    ) {
      ctx.addIssue({ code: 'custom', path: ['sources'], message: '官方資料須有來源連結' })
    }
  })

export type AuditoriumDefinition = z.infer<typeof auditoriumSchema>
export type AuditoriumRow = AuditoriumDefinition['rows'][number]
export type ScreenDefinition = AuditoriumDefinition['screen']
export type DataConfidence = AuditoriumDefinition['confidence']

export function loadAuditorium(data: unknown): AuditoriumDefinition {
  return auditoriumSchema.parse(data)
}
