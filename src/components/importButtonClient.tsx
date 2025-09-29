'use client'

import { CodeEdiftor, Drawer, DrawerToggler } from '@payloadcms/ui' // Удален Upload
import type { CollectionSlug } from 'payload'
import { Fragment, useState } from 'react'

const spinAnimation = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`

const style = document.createElement('style')
style.textContent = spinAnimation
document.head.appendChild(style)

interface ImportButtonClientProps {
  collectionSlug: CollectionSlug
  collectionFields: string[]
  fieldTypes?: Record<string, { type: string; localized?: boolean }>
}

export const ImportButtonClient = (props: ImportButtonClientProps) => {
  const [mode, setMode] = useState<'text' | 'upload'>('text') // Режим по умолчанию установлен на 'text'
  const [importMode, setImportMode] = useState<'add' | 'update' | 'upsert'>('upsert')
  const [jsonInput, setJsonInput] = useState<string>('')
  const [matchField, setMatchField] = useState<string>('id')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  type ImportStep = 'confirmation' | 'dataInput' | 'fieldMapping'
  type ImportStatus = 'created' | 'error' | 'skipped' | 'updated'

  interface ImportResult {
    status: ImportStatus
    id?: string
    error?: string
    data?: Record<string, unknown>
    field?: string
    details?: string
  }

  interface ImportSummary {
    created: number
    updated: number
    skipped: number
    errors: number
  }

  const [importStep, setImportStep] = useState<ImportStep>('dataInput')
  const [parsedJsonData, setParsedJsonData] = useState<null | Record<string, unknown>[]>(null)
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({})
  const [jsonFields, setJsonFields] = useState<string[]>([])
  const [importResults, setImportResults] = useState<ImportResult[] | null>(null)
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null)

  // Установим matchField по умолчанию на основе переданных полей
  useState(() => {
    if (props.collectionFields.length > 0 && !props.collectionFields.includes(matchField)) {
      setMatchField(props.collectionFields[0] || '')
    }
  })

  const handleImport = async () => {
    setIsLoading(true)

    if (importStep === 'dataInput') {
      let dataToParse: unknown
      try {
        dataToParse = JSON.parse(jsonInput)
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error parsing JSON:', error)
        alert('Invalid JSON format')
        setIsLoading(false)
        return
      }
      // Assume dataToParse is an array of objects or a single object that needs to be converted to an array
      const dataArray = Array.isArray(dataToParse) ? dataToParse : [dataToParse]
      setParsedJsonData(dataArray)

      // Extract fields from the first JSON object for mapping
      if (dataArray.length > 0) {
        const firstItemFields = Object.keys(dataArray[0])
        setJsonFields(firstItemFields)
        // Pre-map fields if names match
        const initialMappings: Record<string, string> = {}
        firstItemFields.forEach((jsonField) => {
          if (props.collectionFields.includes(jsonField)) {
            initialMappings[jsonField] = jsonField
          } else {
            initialMappings[jsonField] = '' // No mapping by default
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
      // Send data to server for actual import
      if (!parsedJsonData) {
        alert('No data to import')
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
            fieldTypes: props.fieldTypes, // Добавлен fieldTypes
          }), // Добавлены fieldMappings
        })

        if (!response.ok) {
          throw new Error(`Import failed: ${response.statusText}`)
        }

        const result = await response.json()

        if (result.results) {
          setImportResults(result.results)
          const summary = result.results.reduce(
            (acc: ImportSummary, item: ImportResult) => {
              if (item.status === 'created') {
                acc.created++
              }
              if (item.status === 'updated') {
                acc.updated++
              }
              if (item.status === 'skipped') {
                acc.skipped++
              }
              if (item.status === 'error') {
                acc.errors++
              }
              return acc
            },
            { created: 0, updated: 0, skipped: 0, errors: 0 },
          )
          setImportSummary(summary)
        }

        alert('Import completed. Please review the results.')
        setImportStep('confirmation') // Stay on confirmation step to show results
      } catch (error) {
        // eslint-disable-next-line no-console
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
              <button
                type="button"
                onClick={() => setMode('text')}
                style={{ border: mode === 'text' ? '1px solid black' : 'none' }}
              >
                Enter JSON
              </button>
            </div>
            <div style={{ marginTop: '1rem' }}>
              <label htmlFor="json-input">Enter your JSON here:</label>
              <div
                style={{
                  marginTop: '0.5rem',
                  color: 'var(--theme-text-secondary)',
                  fontSize: '0.9em',
                }}
              >
                <span>Field format examples:</span>
                <pre
                  style={{
                    background: 'var(--theme-elevation-100)',
                    padding: '8px',
                    borderRadius: '4px',
                    margin: '4px 0',
                    color: 'var(--theme-text)',
                  }}
                >
                  {`// Localized field:
{
  "title": {
    "en": "Title",
    "fr": "Titre",
    "de": "Titel"
  }
}

// Rich text field:
{
  "description": "Your text content here"
}

// Localized rich text:
{
  "description": {
    "en": "English text content",
    "fr": "Contenu en français"
  }
}`}
                </pre>
              </div>
              <CodeEdiftor
                value={jsonInput}
                onChange={(e) => setJsonInput(e || '')}
                language="json"
                height="200px"
              />
            </div>

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
            <p>Map your JSON fields to collection fields.</p>
            <div
              style={{
                marginBottom: '1rem',
                padding: '10px',
                backgroundColor: 'var(--theme-elevation-50)',
                borderRadius: '4px',
              }}
            >
              <p style={{ margin: '0', color: 'var(--theme-text-secondary)' }}>
                <strong>Tip:</strong> For localized fields, make sure the value in JSON is an object
                with language codes (e.g., en, fr, de).
              </p>
            </div>
            <div
              style={{
                maxHeight: '300px',
                overflowY: 'auto',
                border: '1px solid #ccc',
                padding: '10px',
                borderRadius: '4px',
              }}
            >
              {jsonFields.length === 0 ? (
                <p>No fields found in JSON data.</p>
              ) : (
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    color: 'var(--theme-text)',
                    backgroundColor: 'var(--theme-bg)',
                  }}
                >
                  <thead>
                    <tr>
                      <th
                        style={{
                          border: '1px solid var(--theme-border-color)',
                          padding: '8px',
                          textAlign: 'left',
                          backgroundColor: 'var(--theme-elevation-100)',
                          color: 'var(--theme-text)',
                        }}
                      >
                        JSON Field
                      </th>
                      <th
                        style={{
                          border: '1px solid var(--theme-border-color)',
                          padding: '8px',
                          textAlign: 'left',
                          backgroundColor: 'var(--theme-elevation-100)',
                          color: 'var(--theme-text)',
                        }}
                      >
                        Collection Field
                      </th>
                      <th
                        style={{
                          border: '1px solid var(--theme-border-color)',
                          padding: '8px',
                          textAlign: 'left',
                          backgroundColor: 'var(--theme-elevation-100)',
                          color: 'var(--theme-text)',
                        }}
                      >
                        Field Type
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {jsonFields.map((jsonField) => {
                      const sampleValue = parsedJsonData[0]?.[jsonField]
                      const getFieldInfo = (field: string) => {
                        const fieldType = props.fieldTypes?.[field]
                        if (!fieldType) {
                          return { type: 'unknown', color: 'var(--theme-text)' }
                        }

                        const type = fieldType.type === 'richText' ? 'richText' : fieldType.type
                        const isLocalized = fieldType.localized
                        const color =
                          type === 'richText'
                            ? '#e040fb'
                            : isLocalized
                              ? '#64b5f6'
                              : 'var(--theme-text)'
                        return { type, isLocalized, color }
                      }

                      return (
                        <tr key={jsonField} style={{ backgroundColor: 'var(--theme-bg)' }}>
                          <td
                            style={{
                              border: '1px solid var(--theme-border-color)',
                              padding: '8px',
                              color: 'var(--theme-text)',
                            }}
                          >
                            {jsonField}
                            {(() => {
                              if (
                                sampleValue &&
                                typeof sampleValue === 'object' &&
                                !Array.isArray(sampleValue)
                              ) {
                                return (
                                  <div
                                    style={{
                                      fontSize: '0.8em',
                                      color: 'var(--theme-text-secondary)',
                                      marginTop: '4px',
                                    }}
                                  >
                                    Available languages:{' '}
                                    {Object.keys(sampleValue as Record<string, unknown>).join(', ')}
                                  </div>
                                )
                              }
                              return null
                            })()}
                          </td>
                          <td
                            style={{
                              border: '1px solid var(--theme-border-color)',
                              padding: '8px',
                            }}
                          >
                            <select
                              value={fieldMappings[jsonField] || ''}
                              onChange={(e) =>
                                setFieldMappings({
                                  ...fieldMappings,
                                  [jsonField]: e.target.value,
                                })
                              }
                              style={{
                                width: '100%',
                                padding: '5px',
                                backgroundColor: 'var(--theme-input-bg)',
                                color: 'var(--theme-text)',
                                border: '1px solid var(--theme-border-color)',
                              }}
                            >
                              <option value="">Do not import</option>
                              {props.collectionFields.map((collectionField) => (
                                <option key={collectionField} value={collectionField}>
                                  {collectionField}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td
                            style={{
                              border: '1px solid var(--theme-border-color)',
                              padding: '8px',
                            }}
                          >
                            {fieldMappings[jsonField] && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span
                                  style={{ color: getFieldInfo(fieldMappings[jsonField]).color }}
                                >
                                  {getFieldInfo(fieldMappings[jsonField]).type}
                                </span>
                                {getFieldInfo(fieldMappings[jsonField]).isLocalized && (
                                  <span style={{ color: '#64b5f6', fontSize: '0.8em' }}>
                                    (localized)
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
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

            {importSummary && (
              <div style={{ marginBottom: '1.5rem', background: 'var(--theme-elevation-50)' }}>
                <h3>Import Summary:</h3>
                <div style={{ display: 'flex', gap: '20px', marginTop: '10px' }}>
                  <div
                    style={{
                      padding: '10px 20px',
                      borderRadius: '4px',
                      backgroundColor: '#e8f5e9',
                      border: '1px solid #4caf50',
                    }}
                  >
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4caf50' }}>
                      {importSummary.created}
                    </div>
                    <div style={{ color: '#2e7d32' }}>Created</div>
                  </div>

                  <div
                    style={{
                      padding: '10px 20px',
                      borderRadius: '4px',
                      backgroundColor: '#e3f2fd',
                      border: '1px solid #2196f3',
                    }}
                  >
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2196f3' }}>
                      {importSummary.updated}
                    </div>
                    <div style={{ color: '#1565c0' }}>Updated</div>
                  </div>

                  <div
                    style={{
                      padding: '10px 20px',
                      borderRadius: '4px',
                      backgroundColor: '#fff3e0',
                      border: '1px solid #ff9800',
                    }}
                  >
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ff9800' }}>
                      {importSummary.skipped}
                    </div>
                    <div style={{ color: '#ef6c00' }}>Skipped</div>
                  </div>

                  <div
                    style={{
                      padding: '10px 20px',
                      borderRadius: '4px',
                      backgroundColor: '#ffebee',
                      border: '1px solid #f44336',
                    }}
                  >
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f44336' }}>
                      {importSummary.errors}
                    </div>
                    <div style={{ color: '#c62828' }}>Errors</div>
                  </div>
                </div>
              </div>
            )}

            {importResults && importResults.length > 0 && (
              <div
                style={{
                  maxHeight: '400px',
                  overflowY: 'auto',
                  border: '1px solid #ccc',
                  padding: '10px',
                  borderRadius: '4px',
                }}
              >
                <h3>Detailed Results:</h3>
                <div style={{ marginBottom: '1rem', backgroundColor: 'var(--theme-elevation-50)' }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!importResults) {
                        return
                      }

                      const errorsOnly = importResults.filter((r) => r.status === 'error')
                      if (errorsOnly.length > 0) {
                        const errorReport = errorsOnly.map((r) => ({
                          field: r.field || 'N/A',
                          error: r.error || 'Unknown error',
                          details:
                            r.details || (r.data ? JSON.stringify(r.data, null, 2) : 'No details'),
                        }))
                        // eslint-disable-next-line no-console
                        console.table(errorReport)
                      } else {
                        // eslint-disable-next-line no-console
                        console.log('No errors found during import')
                      }
                    }}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: 'var(--theme-elevation-50)',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Show Errors in Console
                  </button>
                </div>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    color: 'var(--theme-text)',
                    backgroundColor: 'var(--theme-bg)',
                  }}
                >
                  <thead>
                    <tr style={{ backgroundColor: 'var(--theme-bg)' }}>
                      <th
                        style={{
                          border: '1px solid #ccc',
                          padding: '8px',
                          textAlign: 'left',
                          backgroundColor: 'var(--theme-elevation-50)',
                        }}
                      >
                        Status
                      </th>
                      <th
                        style={{
                          border: '1px solid #ccc',
                          padding: '8px',
                          textAlign: 'left',
                          backgroundColor: 'var(--theme-elevation-50)',
                        }}
                      >
                        ID
                      </th>
                      <th
                        style={{
                          border: '1px solid #ccc',
                          padding: '8px',
                          textAlign: 'left',
                          backgroundColor: 'var(--theme-elevation-50)',
                        }}
                      >
                        Field
                      </th>
                      <th
                        style={{
                          border: '1px solid #ccc',
                          padding: '8px',
                          textAlign: 'left',
                          backgroundColor: 'var(--theme-elevation-50)',
                        }}
                      >
                        Error
                      </th>
                      <th
                        style={{
                          border: '1px solid #ccc',
                          padding: '8px',
                          textAlign: 'left',
                          backgroundColor: 'var(--theme-elevation-50)',
                        }}
                      >
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {importResults.map((result, index) => {
                      const getStatusColor = (status: ImportStatus) => {
                        switch (status) {
                          case 'created':
                            return '#4caf50'
                          case 'error':
                            return '#f44336'
                          case 'skipped':
                            return '#ff9800'
                          case 'updated':
                            return '#2196f3'
                        }
                      }

                      const getStatusText = (status: ImportStatus) => {
                        switch (status) {
                          case 'created':
                            return 'Created'
                          case 'error':
                            return 'Error'
                          case 'skipped':
                            return 'Skipped'
                          case 'updated':
                            return 'Updated'
                        }
                      }

                      return (
                        <tr
                          key={index}
                          style={{
                            backgroundColor:
                              index % 2 === 0
                                ? 'var(--theme-elevation-100)'
                                : 'var(--theme-elevation-50)',
                          }}
                        >
                          <td
                            style={{
                              border: '1px solid #ccc',
                              padding: '8px',
                              color: getStatusColor(result.status),
                            }}
                          >
                            {getStatusText(result.status)}
                          </td>
                          <td style={{ border: '1px solid #ccc', padding: '8px' }}>
                            {result.id || '-'}
                          </td>
                          <td style={{ border: '1px solid #ccc', padding: '8px' }}>
                            {result.field || '-'}
                          </td>
                          <td style={{ border: '1px solid #ccc', padding: '8px' }}>
                            {result.error ? (
                              <div style={{ color: '#f44336' }}>{result.error}</div>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td style={{ border: '1px solid #ccc', padding: '8px' }}>
                            {result.details ? (
                              <div
                                style={{
                                  maxWidth: '300px',
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-word',
                                }}
                              >
                                {result.details}
                              </div>
                            ) : result.data ? (
                              <pre
                                style={{
                                  margin: 0,
                                  maxWidth: '300px',
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-word',
                                }}
                              >
                                {JSON.stringify(result.data, null, 2)}
                              </pre>
                            ) : (
                              '-'
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {!importSummary && !importResults && (
              <div
                style={{
                  marginTop: '1rem',
                  padding: '1rem',
                  backgroundColor: 'var(--theme-elevation-50)',
                  borderRadius: '4px',
                }}
              >
                <h3>Import Preview:</h3>
                <div style={{ marginBottom: '1rem', backgroundColor: 'var(--theme-elevation-50)' }}>
                  <strong>Import Mode:</strong>{' '}
                  {importMode === 'add'
                    ? 'Add Only'
                    : importMode === 'update'
                      ? 'Update Only'
                      : 'Update and Add'}
                </div>
                {(importMode === 'update' || importMode === 'upsert') && (
                  <div
                    style={{ marginBottom: '1rem', backgroundColor: 'var(--theme-elevation-50)' }}
                  >
                    <strong>Match Field:</strong> {matchField}
                  </div>
                )}
                <div style={{ marginBottom: '1rem', backgroundColor: 'var(--theme-elevation-50)' }}>
                  <strong>Field Mappings:</strong>
                  <pre
                    style={{
                      margin: '0.5rem 0',
                      padding: '1rem',
                      backgroundColor: 'var(--theme-elevation-100)',
                      borderRadius: '4px',
                      maxHeight: '200px',
                      overflowY: 'auto',
                    }}
                  >
                    {JSON.stringify(fieldMappings, null, 2)}
                  </pre>
                </div>
                <div>
                  <strong>Import Data:</strong>
                  <pre
                    style={{
                      margin: '0.5rem 0',
                      padding: '1rem',
                      backgroundColor: 'var(--theme-elevation-100)',
                      borderRadius: '4px',
                      maxHeight: '200px',
                      overflowY: 'auto',
                    }}
                  >
                    {JSON.stringify(parsedJsonData, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
              <button
                type="button"
                onClick={() => {
                  setImportStep('dataInput')
                  setJsonInput('')
                  setParsedJsonData(null)
                  setFieldMappings({})
                  setJsonFields([])
                  setImportResults(null)
                  setImportSummary(null)
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Start New Import
              </button>
              {importResults && (
                <button
                  type="button"
                  onClick={() => {
                    setImportStep('dataInput')
                    setJsonInput('')
                    setParsedJsonData(null)
                    setFieldMappings({})
                    setJsonFields([])
                    setImportResults(null)
                    setImportSummary(null)
                  }}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Import More
                </button>
              )}
            </div>
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
            backgroundColor: importStep === 'confirmation' ? '#28a745' : '#007bff',
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
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            minWidth: '120px',
          }}
        >
          {isLoading ? (
            <>
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid #ffffff',
                  borderTop: '2px solid transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }}
              />
              Processing...
            </>
          ) : importStep === 'dataInput' ? (
            'Next'
          ) : importStep === 'fieldMapping' ? (
            'Review & Confirm'
          ) : (
            'Import'
          )}
        </button>
      </Drawer>
    </Fragment>
  )
}
