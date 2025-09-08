'use client'

import { CodeEdiftor, Drawer, DrawerToggler } from '@payloadcms/ui' // Удален Upload
import type { CollectionSlug } from 'payload'
import { Fragment, useState } from 'react'

interface ImportButtonClientProps {
  collectionSlug: CollectionSlug
  collectionFields: string[] // Добавлен новый пропс
}

export const ImportButtonClient = (props: ImportButtonClientProps) => {
  const [mode, setMode] = useState<'text' | 'upload'>('text') // Режим по умолчанию установлен на 'text'
  const [importMode, setImportMode] = useState<'add' | 'update' | 'upsert'>('upsert')
  const [jsonInput, setJsonInput] = useState<string>('')
  const [matchField, setMatchField] = useState<string>('id')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [importStep, setImportStep] = useState<'dataInput' | 'fieldMapping' | 'confirmation'>(
    'dataInput',
  ) // Новое состояние для этапов импорта
  const [parsedJsonData, setParsedJsonData] = useState<any[] | null>(null) // Для хранения разобранных данных
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({}) // Новое состояние для сопоставления полей
  const [jsonFields, setJsonFields] = useState<string[]>([]) // Поля из JSON

  // Установим matchField по умолчанию на основе переданных полей
  useState(() => {
    if (props.collectionFields.length > 0 && !props.collectionFields.includes(matchField)) {
      setMatchField(props.collectionFields[0] || '')
    }
  })

  const handleImport = async () => {
    setIsLoading(true)

    if (importStep === 'dataInput') {
      let dataToParse: any
      try {
        dataToParse = JSON.parse(jsonInput)
      } catch (error) {
        console.error('Error parsing JSON:', error)
        alert('Invalid JSON format')
        setIsLoading(false)
        return
      }
      // Предполагаем, что dataToParse - это массив объектов или один объект, который нужно преобразовать в массив
      const dataArray = Array.isArray(dataToParse) ? dataToParse : [dataToParse]
      setParsedJsonData(dataArray)

      // Извлекаем поля из первого объекта JSON для сопоставления
      if (dataArray.length > 0) {
        const firstItemFields = Object.keys(dataArray[0])
        setJsonFields(firstItemFields)
        // Предварительное сопоставление полей: если имена совпадают
        const initialMappings: Record<string, string> = {}
        firstItemFields.forEach((jsonField) => {
          if (props.collectionFields.includes(jsonField)) {
            initialMappings[jsonField] = jsonField
          } else {
            initialMappings[jsonField] = '' // По умолчанию нет сопоставления
          }
        })
        setFieldMappings(initialMappings)
      }

      setImportStep('fieldMapping')
      setIsLoading(false)
      return
    }

    if (importStep === 'fieldMapping') {
      // Проверка, что все JSON поля сопоставлены, если это требуется
      // Пока просто переходим к следующему этапу
      setImportStep('confirmation')
      setIsLoading(false)
      return
    }

    if (importStep === 'confirmation') {
      // Логика для отправки данных на сервер (реальный импорт)
      if (!parsedJsonData) {
        alert('No data to import.')
        setIsLoading(false)
        return
      }

      try {
        const response = await fetch(`/api/import-json/${props.collectionSlug}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            collectionSlug: props.collectionSlug,
            data: parsedJsonData,
            importMode,
            matchField,
            fieldMappings,
          }), // Добавлены fieldMappings
        })

        if (!response.ok) {
          throw new Error(`Import failed: ${response.statusText}`)
        }

        const result = await response.json()
        alert(`Import successful: ${result.message}`)
        // Здесь можно добавить логику для закрытия Drawer или обновления списка
        setImportStep('dataInput') // Возвращаемся к начальному этапу после успешного импорта
      } catch (error) {
        console.error('Error during import:', error)
        alert(`Import error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      } finally {
        setIsLoading(false)
      }
      return
    }

    setIsLoading(false)
  }

  return (
    <Fragment>
      <DrawerToggler slug="json-import-modal">Import {props.collectionSlug}</DrawerToggler>
      <Drawer slug="json-import-modal" title={`Import ${props.collectionSlug}`}>
        {importStep === 'dataInput' && (
          <>
            <div style={{ marginBottom: '1rem' }}>
              {/* <button
                type="button"
                onClick={() => setMode('upload')}
                style={{
                  marginRight: '1rem',
                  border: mode === 'upload' ? '1px solid black' : 'none',
                }}
              >
                Upload File
              </button> */}
              <button
                type="button"
                onClick={() => setMode('text')}
                style={{ border: mode === 'text' ? '1px solid black' : 'none' }}
              >
                Enter JSON
              </button>
            </div>
            {/* {mode === 'upload' ? (
              <Upload collectionSlug={props.collectionSlug} uploadConfig={{ staticDir: '/media' }} /> // Временно добавлено uploadConfig с staticDir
            ) : ( */}
            <div style={{ marginTop: '1rem' }}>
              <label htmlFor="json-input">Enter your JSON here:</label>
              <CodeEdiftor
                value={jsonInput}
                onChange={(e) => setJsonInput(e || '')}
                language="json"
                height="200px"
              />
            </div>
            {/* )} */}

            <div style={{ marginTop: '1rem' }}>
              <label htmlFor="import-mode">Import Mode:</label>
              <select
                id="import-mode"
                value={importMode}
                onChange={(e) => setImportMode(e.target.value as 'add' | 'update' | 'upsert')}
                style={{ marginLeft: '1rem', padding: '5px' }}
              >
                <option value="add">Add Only</option>
                <option value="update">Update Only</option>
                <option value="upsert">Update and Add</option>
              </select>
            </div>

            {(importMode === 'update' || importMode === 'upsert') && (
              <div style={{ marginTop: '1rem' }}>
                <label htmlFor="match-field">Match Field:</label>
                <select
                  id="match-field"
                  value={matchField}
                  onChange={(e) => setMatchField(e.target.value)}
                  style={{ marginLeft: '1rem', padding: '5px', width: '200px' }}
                >
                  {props.collectionFields.map((field) => (
                    <option key={field} value={field}>
                      {field}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}

        {importStep === 'fieldMapping' && parsedJsonData && (
          <div>
            <h2>Field Mapping (Step 2)</h2>
            <p>Map your JSON fields to the collection fields.</p>
            <div
              style={{
                maxHeight: '300px',
                overflowY: 'auto',
                border: '1px solid #ccc',
                padding: '10px',
              }}
            >
              {jsonFields.length === 0 ? (
                <p>No fields found in JSON data.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'left' }}>
                        JSON Field
                      </th>
                      <th style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'left' }}>
                        Collection Field
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {jsonFields.map((jsonField) => (
                      <tr key={jsonField}>
                        <td style={{ border: '1px solid #ccc', padding: '8px' }}>{jsonField}</td>
                        <td style={{ border: '1px solid #ccc', padding: '8px' }}>
                          <select
                            value={fieldMappings[jsonField] || ''}
                            onChange={(e) =>
                              setFieldMappings({
                                ...fieldMappings,
                                [jsonField]: e.target.value,
                              })
                            }
                            style={{ width: '100%', padding: '5px' }}
                          >
                            <option value="">Do not import</option>
                            {props.collectionFields.map((collectionField) => (
                              <option key={collectionField} value={collectionField}>
                                {collectionField}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {importStep === 'confirmation' && (
          <div>
            <h2>Confirmation (Step 3)</h2>
            <p>Review and confirm your import.</p>
            {/* UI для подтверждения будет здесь */}
            <pre>
              {JSON.stringify(
                { importMode, matchField, fieldMappings, data: parsedJsonData },
                null,
                2,
              )}
            </pre>
          </div>
        )}

        <button
          type="button"
          onClick={handleImport}
          disabled={
            isLoading ||
            (importStep === 'dataInput' && !jsonInput && mode === 'text') ||
            (importStep === 'fieldMapping' &&
              Object.values(fieldMappings).some(
                (val) => val === '' && !props.collectionFields.includes(val),
              ))
          }
          style={{
            marginTop: '1.5rem',
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor:
              isLoading ||
              (importStep === 'dataInput' && !jsonInput && mode === 'text') ||
              (importStep === 'fieldMapping' &&
                Object.values(fieldMappings).some(
                  (val) => val === '' && !props.collectionFields.includes(val),
                ))
                ? 'not-allowed'
                : 'pointer',
          }}
        >
          {isLoading
            ? 'Processing...'
            : importStep === 'dataInput'
              ? 'Next'
              : importStep === 'fieldMapping'
                ? 'Review & Confirm'
                : 'Import'}
        </button>
      </Drawer>
    </Fragment>
  )
}
