'use server'
import type { ServerComponentProps } from 'payload'
import { ImportButtonClient } from './importButtonClient.js'

// @ts-ignore
export const ImportButtonServer = async (props: ServerComponentProps) => {
  const collectionSlug = props.collectionSlug
  const collection = props.payload.collections[collectionSlug]

  if (!collection) {
    // Обработка случая, если коллекция не найдена
    return <div>Collection {collectionSlug} not found.</div>
  }

  const fields = collection.config.fields
    .map((field) => ('name' in field ? field.name : null))
    .filter(Boolean)
    .concat('id') // Добавлено поле 'id'

  return (
    <ImportButtonClient
      collectionSlug={props.collectionSlug}
      collectionFields={fields as string[]}
    />
  )
}
