import type { PayloadRequest } from 'payload'

import { NextResponse } from 'next/server.js'

interface ImportResult {
  status: 'created' | 'error' | 'skipped' | 'updated'
  id?: string
  error?: string
  data?: unknown
  field?: string
  details?: string
}

interface ImportSummary {
  created: number
  error: number
  skipped: number
  updated: number
}

interface ImportResponse {
  message?: string
  error?: string
  details?: Record<string, unknown> | string
  results?: ImportResult[]
  summary?: ImportSummary
}

export async function importJsonData(req: PayloadRequest): Promise<NextResponse<ImportResponse>> {
  try {
    interface RequestBody {
      collectionSlug: string
      data: Record<string, unknown>[]
      importMode: 'add' | 'update' | 'upsert'
      matchField?: string
      fieldMappings: Record<string, string>
      fieldTypes?: Record<string, { type: string; localized?: boolean }>
    }

    let requestBody: RequestBody

    try {
      if (!req.headers.get('content-type')?.includes('application/json') || !req.json) {
        return NextResponse.json(
          { error: 'Invalid content type or request body format' },
          { status: 400 },
        )
      }

      const parsedBody = await req.json()

      if (!parsedBody || typeof parsedBody !== 'object') {
        return NextResponse.json({ error: 'Invalid request body structure' }, { status: 400 })
      }

      const { collectionSlug, data, importMode, matchField, fieldMappings, fieldTypes } =
        parsedBody as {
          collectionSlug: string
          data: Record<string, unknown>[]
          importMode: 'add' | 'update' | 'upsert'
          matchField?: string
          fieldMappings: Record<string, string>
          fieldTypes?: Record<string, { type: string; localized?: boolean }>
        }

      if (!collectionSlug || !data || !importMode) {
        return NextResponse.json(
          {
            error: 'Missing required parameters',
            details: { collectionSlug, data, importMode },
          },
          { status: 400 },
        )
      }

      requestBody = { collectionSlug, data, importMode, matchField, fieldMappings, fieldTypes }
    } catch (error) {
      return NextResponse.json(
        {
          error: 'Failed to parse request body',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 400 },
      )
    }

    const collection = req.payload.collections[requestBody.collectionSlug]

    if (!collection) {
      return NextResponse.json(
        {
          error: `Collection ${requestBody.collectionSlug} not found`,
          details: `Available collections: ${Object.keys(req.payload.collections).join(', ')}`,
        },
        { status: 404 },
      )
    }

    const results: ImportResult[] = []

    for (const item of requestBody.data) {
      const mappedData: Record<string, unknown> = {}
      let hasErrors = false

      // Обработка полей с учетом локализации
      for (const jsonField in requestBody.fieldMappings) {
        const collectionField = requestBody.fieldMappings[jsonField]
        if (collectionField && item[jsonField] !== undefined) {
          const value = item[jsonField]

          // Handle localized fields
          if (requestBody.fieldTypes?.[collectionField]?.localized) {
            // Если поле имеет формат field.locale
            if (jsonField.includes('.')) {
              const [baseField, locale] = jsonField.split('.')
              if (!mappedData[baseField]) {
                mappedData[baseField] = {}
              }
              ;(mappedData[baseField] as Record<string, unknown>)[locale] = value
              continue // Пропускаем дальнейшую обработку этого поля
            }
            // Если значение уже в формате объекта локализации
            else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
              // Проверяем, что все значения в объекте локализации являются строками
              const localizedValue: Record<string, unknown> = {}
              let hasInvalidValue = false

              for (const [lang, text] of Object.entries(value)) {
                if (typeof text === 'string') {
                  localizedValue[lang] = text
                } else {
                  results.push({
                    status: 'error',
                    error: 'Invalid localization value type',
                    field: `${collectionField}.${lang}`,
                    details: `Field ${collectionField} language ${lang} requires string but received ${typeof text}`,
                    data: { [jsonField]: value },
                  })
                  hasInvalidValue = true
                  break
                }
              }

              if (!hasInvalidValue) {
                mappedData[collectionField] = localizedValue
              } else {
                hasErrors = true
                continue
              }
            } else {
              results.push({
                status: 'error',
                error: 'Invalid localization format',
                field: collectionField,
                details: `Field ${collectionField} requires localization object but received ${typeof value}. Expected format: { locale: value } or field.locale: value`,
                data: { [jsonField]: value },
              })
              hasErrors = true
              continue
            }
          }
          // Handle richtext fields
          else if (requestBody.fieldTypes?.[collectionField]?.type === 'richText') {
            // eslint-disable-next-line no-console
            console.log('Processing richtext field:', { collectionField, jsonField, value })

            const createRichTextNode = (text: string) => {
              const node = {
                children: [
                  {
                    children: [
                      {
                        detail: 0,
                        format: 0,
                        mode: 'normal',
                        style: '',
                        text,
                        type: 'text',
                        version: 1,
                      },
                    ],
                    direction: 'ltr',
                    format: '',
                    indent: 0,
                    type: 'paragraph',
                    version: 1,
                  },
                ],
                direction: 'ltr',
                format: '',
                indent: 0,
                type: 'root',
                version: 1,
              }
              // eslint-disable-next-line no-console
              console.log('Created richtext node:', node)
              return node
            }

            // Если поле имеет формат field.locale для локализованного richtext
            if (jsonField.includes('.')) {
              const [baseField, locale] = jsonField.split('.')
              if (typeof value === 'string') {
                if (!mappedData[baseField]) {
                  mappedData[baseField] = {}
                }
                ;(mappedData[baseField] as Record<string, unknown>)[locale] =
                  createRichTextNode(value)
                continue
              } else {
                results.push({
                  status: 'error',
                  error: 'Invalid richtext format',
                  field: collectionField,
                  details: `Field ${collectionField}.${locale} requires string but received ${typeof value}`,
                  data: { [jsonField]: value },
                })
                hasErrors = true
                continue
              }
            }
            // Если значение - простая строка
            else if (typeof value === 'string') {
              mappedData[collectionField] = createRichTextNode(value)
            }
            // Если значение - объект локализации
            else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
              const localizedRichtext: Record<string, unknown> = {}
              for (const [lang, text] of Object.entries(value)) {
                if (typeof text === 'string') {
                  localizedRichtext[lang] = createRichTextNode(text)
                } else {
                  results.push({
                    status: 'error',
                    error: 'Invalid richtext localization format',
                    field: collectionField,
                    details: `Field ${collectionField} language ${lang} requires string but received ${typeof text}`,
                    data: { [jsonField]: value },
                  })
                  hasErrors = true
                  break
                }
              }
              if (!hasErrors) {
                mappedData[collectionField] = localizedRichtext
              }
              continue
            }
            // Неверный формат
            else {
              results.push({
                status: 'error',
                error: 'Invalid richtext format',
                field: collectionField,
                details: `Field ${collectionField} requires string or localization object but received ${typeof value}`,
                data: { [jsonField]: value },
              })
              hasErrors = true
              continue
            }
          }
          // Handle regular fields
          else {
            mappedData[collectionField] = value
          }
        }
      }

      if (hasErrors) {
        continue
      }

      try {
        // eslint-disable-next-line no-console
        console.log('Final mapped data:', mappedData)

        if (requestBody.importMode === 'add') {
          const doc = await req.payload.db.create({
            collection: requestBody.collectionSlug,
            data: mappedData,
          })
          results.push({ status: 'created', id: doc.id.toString() })
        } else if (requestBody.importMode === 'update' || requestBody.importMode === 'upsert') {
          if (!requestBody.matchField) {
            results.push({
              status: 'error',
              error: 'Match field is required for update/upsert mode',
            })
            continue
          }

          const findResult = await req.payload.db.find({
            collection: requestBody.collectionSlug,
            where: { [requestBody.matchField]: { equals: mappedData[requestBody.matchField] } },
          })

          if (findResult.docs.length > 0) {
            const existingDoc = findResult.docs[0]
            const doc = await req.payload.db.updateOne({
              collection: requestBody.collectionSlug,
              id: existingDoc.id,
              data: mappedData,
            })
            results.push({ status: 'updated', id: doc.id.toString() })
          } else if (requestBody.importMode === 'upsert') {
            const doc = await req.payload.db.create({
              collection: requestBody.collectionSlug,
              data: mappedData,
            })
            results.push({ status: 'created', id: doc.id.toString() })
          } else {
            results.push({
              status: 'skipped',
              error: 'Document not found for update',
              data: mappedData[requestBody.matchField],
              field: requestBody.matchField,
            })
          }
        }
      } catch (opError: unknown) {
        const errorMessage = opError instanceof Error ? opError.message : 'Unknown operation error'

        // Извлекаем имя поля из сообщения об ошибке
        let field = 'N/A'
        const details = opError instanceof Error ? opError.stack : undefined

        if (opError instanceof Error) {
          const match = opError.message.match(/failed: ([^:]+):/)
          if (match) {
            field = match[1]
          }

          // Если это ошибка валидации Mongoose, добавляем больше деталей
          if (opError.message.includes('ValidationError')) {
            const validationMatch = opError.message.match(/validation failed: (.+)/)
            if (validationMatch) {
              const validationDetails = validationMatch[1]
              const fieldErrors = validationDetails.split(', ')
              field = fieldErrors[0].split(':')[0]
            }
          }
        }

        results.push({
          status: 'error',
          error: errorMessage,
          field,
          data: item,
          details,
        })
      }
    }

    interface ImportSummary {
      created: number
      error: number
      skipped: number
      updated: number
    }

    // Группируем результаты по статусу
    const summary = results.reduce<ImportSummary>(
      (acc, result) => {
        acc[result.status] = (acc[result.status] || 0) + 1
        return acc
      },
      { created: 0, error: 0, skipped: 0, updated: 0 },
    )

    return NextResponse.json(
      {
        message: 'Import process completed',
        results,
        summary,
      },
      { status: 200 },
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      {
        error: `Server error: ${message}`,
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    )
  }
}
