import type { PayloadRequest } from 'payload'

import { NextResponse } from 'next/server.js'

export async function importJsonData(req: PayloadRequest) {
  try {
    let requestBody: any
    if (req.headers.get('content-type')?.includes('application/json') && req.json) {
      requestBody = await req.json()
    } else {
      console.error('Unexpected content type or req.body format.')
      return NextResponse.json(
        { error: 'Invalid content type or request body format' },
        { status: 400 },
      )
    }

    if (!requestBody || typeof requestBody !== 'object') {
      console.error('Parsed request body is not an object:', requestBody)
      return NextResponse.json({ error: 'Invalid request body structure' }, { status: 400 })
    }

    const { collectionSlug, data, importMode, matchField, fieldMappings } = requestBody as {
      collectionSlug: string
      data: any[]
      importMode: 'add' | 'update' | 'upsert'
      matchField?: string
      fieldMappings: Record<string, string>
    }

    if (!collectionSlug || !data || !importMode) {
      console.error('Missing required parameters after parsing:', {
        collectionSlug,
        data,
        importMode,
      })
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    // const collection = payload.collections[collectionSlug]
    // const collection = this.collections[collectionSlug] // Использование this.collections
    const collection = req.payload.collections[collectionSlug] // Возвращено использование req.payload.collections
    // console.log('Available collection slugs from req.payload:', Object.keys(req.payload.collections)) // Логирование

    if (!collection) {
      console.error(`Collection ${collectionSlug} not found.`) // Логирование
      return NextResponse.json({ error: `Collection ${collectionSlug} not found` }, { status: 404 })
    }

    const results: { status: string; id?: string; error?: string; data?: any }[] = []

    for (const item of data) {
      const mappedData: Record<string, any> = {}
      for (const jsonField in fieldMappings) {
        const collectionField = fieldMappings[jsonField]
        if (collectionField && item[jsonField] !== undefined) {
          mappedData[collectionField] = item[jsonField]
        }
      }

      try {
        if (importMode === 'add') {
          // const doc = await this.create({ collection: collectionSlug, data: mappedData }) // Использование this.create
          const doc = await req.payload.create({ collection: collectionSlug, data: mappedData }) // Использование req.payload.create
          results.push({ status: 'created', id: doc.id.toString() })
        } else if (importMode === 'update' || importMode === 'upsert') {
          if (!matchField) {
            results.push({
              status: 'error',
              error: 'Match field is required for update/upsert mode',
            })
            continue
          }

          // const findResult = await this.find({ collection: collectionSlug, where: { [matchField]: { equals: mappedData[matchField] } } }) // Использование this.find
          const findResult = await req.payload.find({
            collection: collectionSlug,
            where: { [matchField]: { equals: mappedData[matchField] } },
          }) // Использование req.payload.find

          if (findResult.docs.length > 0) {
            const existingDoc = findResult.docs[0]
            // const doc = await this.update({ collection: collectionSlug, id: existingDoc.id, data: mappedData }) // Использование this.update
            const doc = await req.payload.db.updateOne({
              collection: collectionSlug,
              id: existingDoc.id,
              data: mappedData,
            }) // Использование req.payload.update
            results.push({ status: 'updated', id: doc.id.toString() })
          } else if (importMode === 'upsert') {
            // const doc = await this.create({ collection: collectionSlug, data: mappedData }) // Использование this.create
            const doc = await req.payload.db.create({
              collection: collectionSlug,
              data: mappedData,
            }) // Использование req.payload.create
            results.push({ status: 'created', id: doc.id.toString() })
          } else {
            results.push({ status: 'skipped', error: 'Document not found for update' })
          }
        }
      } catch (opError: unknown) {
        const errorMessage = opError instanceof Error ? opError.message : 'Unknown operation error'
        results.push({ status: 'error', error: errorMessage, data: item })
      }
    }

    await req.payload.update({
      collection: collectionSlug,
      data: {},
      where: {
        id: {
          in: results
            ?.filter((r) => r.status === 'created' || r.status === 'updated')
            ?.map((r) => r.id),
        },
      },
    })
    return NextResponse.json({ message: 'Import process completed', results }, { status: 200 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Top-level server error:', error) // Логирование
    return NextResponse.json({ error: `Server error: ${message}` }, { status: 500 })
  }
}
