'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowPathIcon,
  CheckCircleIcon,
  CloudArrowUpIcon,
  DocumentMagnifyingGlassIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid'
import { Subheading } from '@/components/heading'
import { Button } from '@/components/button'
import { Text } from '@/components/text'
import { Input } from '@/components/input'
import { Badge } from '@/components/badge'
import { Field, Label, Description } from '@/components/fieldset'
import { useApiData, useApiToken } from '@/lib/hooks'
import { ApiError, api } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import type { KnowledgeDocTypeInfo, KnowledgeStatus, RagDocument } from '@/lib/types'

type Bundle = {
  docTypes: KnowledgeDocTypeInfo[]
  status: KnowledgeStatus
  documents: RagDocument[]
}

/** Visual theme per doc_type — borders, accents, soft backgrounds */
const SECTION_THEME: Record<
  string,
  { ring: string; bg: string; iconWrap: string; bar: string; label: string }
> = {
  pricing: {
    ring: 'ring-emerald-500/20 dark:ring-emerald-400/25',
    bg: 'from-emerald-50/90 to-white dark:from-emerald-950/40 dark:to-zinc-900',
    iconWrap: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
    bar: 'from-emerald-400 to-teal-500',
    label: 'text-emerald-800 dark:text-emerald-200',
  },
  policy_warranty: {
    ring: 'ring-sky-500/20 dark:ring-sky-400/25',
    bg: 'from-sky-50/90 to-white dark:from-sky-950/35 dark:to-zinc-900',
    iconWrap: 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300',
    bar: 'from-sky-400 to-blue-500',
    label: 'text-sky-900 dark:text-sky-200',
  },
  technical: {
    ring: 'ring-amber-500/25 dark:ring-amber-400/20',
    bg: 'from-amber-50/90 to-white dark:from-amber-950/35 dark:to-zinc-900',
    iconWrap: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
    bar: 'from-amber-400 to-orange-500',
    label: 'text-amber-900 dark:text-amber-100',
  },
  general: {
    ring: 'ring-violet-500/20 dark:ring-violet-400/25',
    bg: 'from-violet-50/90 to-white dark:from-violet-950/35 dark:to-zinc-900',
    iconWrap: 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300',
    bar: 'from-violet-400 to-purple-500',
    label: 'text-violet-900 dark:text-violet-200',
  },
}

const defaultTheme = {
  ring: 'ring-zinc-300 dark:ring-zinc-600',
  bg: 'from-zinc-50 to-white dark:from-zinc-900 dark:to-zinc-900',
  iconWrap: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200',
  bar: 'from-zinc-400 to-zinc-600',
  label: 'text-zinc-800 dark:text-zinc-200',
}

type SectionPhase = 'idle' | 'uploading' | 'success'

type SectionUploadState = {
  phase: SectionPhase
  progress: number
  successTitle?: string
  successFilename?: string
  successChunks?: number
}

function SectionProgressBar({
  phase,
  progress,
  barClass,
}: {
  phase: SectionPhase
  progress: number
  barClass: string
}) {
  const width = phase === 'uploading' ? Math.min(progress, 92) : phase === 'success' ? 100 : 0
  const indeterminate = phase === 'uploading' && progress < 15

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200/80 dark:bg-zinc-800">
      <div
        className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ease-out ${barClass} ${
          indeterminate ? 'animate-pulse' : ''
        }`}
        style={{ width: phase === 'idle' ? '0%' : `${width}%` }}
        role="progressbar"
        aria-valuenow={width}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  )
}

export function DocumentsTab() {
  const getToken = useApiToken()

  const fetchBundle = useCallback(async (token: string): Promise<Bundle> => {
    const [docTypes, status, documents] = await Promise.all([
      api.knowledge.docTypes(token),
      api.knowledge.status(token),
      api.knowledge.listDocuments(token),
    ])
    return { docTypes, status, documents }
  }, [])

  const { data, loading, error, refetch } = useApiData(fetchBundle, [])

  const [titles, setTitles] = useState<Record<string, string>>({})
  const [files, setFiles] = useState<Record<string, File | null>>({})
  const [sectionState, setSectionState] = useState<Record<string, SectionUploadState>>({})

  const [replaceId, setReplaceId] = useState<string | null>(null)
  const [replaceTitle, setReplaceTitle] = useState('')
  const [replaceFile, setReplaceFile] = useState<File | null>(null)
  const [replacing, setReplacing] = useState(false)
  const [replaceSectionId, setReplaceSectionId] = useState<string | null>(null)

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const progressTimers = useRef<Record<string, ReturnType<typeof setInterval>>>({})

  const byType = useMemo(() => {
    const m = new Map<string, RagDocument[]>()
    for (const d of data?.documents ?? []) {
      const list = m.get(d.doc_type) ?? []
      list.push(d)
      m.set(d.doc_type, list)
    }
    return m
  }, [data?.documents])

  const clearProgressTimer = (sectionId: string) => {
    const t = progressTimers.current[sectionId]
    if (t) clearInterval(t)
    delete progressTimers.current[sectionId]
  }

  const startFakeProgress = (sectionId: string) => {
    clearProgressTimer(sectionId)
    let p = 5
    progressTimers.current[sectionId] = setInterval(() => {
      p += Math.random() * 12
      if (p > 88) p = 88
      setSectionState((prev) => ({
        ...prev,
        [sectionId]: { ...prev[sectionId], phase: 'uploading', progress: p },
      }))
    }, 280)
  }

  const finishSectionSuccess = (
    sectionId: string,
    meta: { title: string; filename: string; chunks: number },
  ) => {
    clearProgressTimer(sectionId)
    setSectionState((prev) => ({
      ...prev,
      [sectionId]: {
        phase: 'success',
        progress: 100,
        successTitle: meta.title,
        successFilename: meta.filename,
        successChunks: meta.chunks,
      },
    }))
    setFiles((f) => ({ ...f, [sectionId]: null }))
    setTitles((t) => ({ ...t, [sectionId]: '' }))
  }

  useEffect(() => {
    return () => {
      Object.keys(progressTimers.current).forEach(clearProgressTimer)
    }
  }, [])

  const handleSectionUpload = async (sectionId: string) => {
    const title = (titles[sectionId] ?? '').trim()
    const file = files[sectionId] ?? null
    if (!title) {
      notifyError('Add a short title so you can recognize this file later.')
      return
    }
    if (!file) {
      notifyError('Choose a file to upload for this category.')
      return
    }
    if (!data?.status.rag_configured) return

    setSectionState((prev) => ({
      ...prev,
      [sectionId]: { phase: 'uploading', progress: 8 },
    }))
    startFakeProgress(sectionId)

    try {
      const token = await getToken()
      const fd = new FormData()
      fd.append('doc_type', sectionId)
      fd.append('title', title)
      fd.append('file', file)
      const res = await api.knowledge.uploadDocument(token, fd)
      finishSectionSuccess(sectionId, {
        title: res.title,
        filename: res.original_filename,
        chunks: res.chunk_count,
      })
      notifySuccess(`${sectionLabel(sectionId)} saved to your knowledge base.`)
      await refetch()
    } catch (e) {
      clearProgressTimer(sectionId)
      setSectionState((prev) => ({
        ...prev,
        [sectionId]: { phase: 'idle', progress: 0 },
      }))
      notifyError(e instanceof ApiError ? e.message : 'Upload failed')
    }
  }

  const sectionLabel = (id: string) =>
    data?.docTypes.find((d) => d.id === id)?.title ?? id

  const startReplace = (doc: RagDocument) => {
    setReplaceId(doc.id)
    setReplaceSectionId(doc.doc_type)
    setReplaceTitle(doc.title)
    setReplaceFile(null)
  }

  const cancelReplace = () => {
    setReplaceId(null)
    setReplaceSectionId(null)
    setReplaceFile(null)
  }

  const handleReplace = async () => {
    if (!replaceId || !replaceFile || !replaceSectionId) {
      notifyError('Choose a new file to replace this document.')
      return
    }
    if (!replaceTitle.trim()) {
      notifyError('Title cannot be empty.')
      return
    }
    setReplacing(true)
    setSectionState((prev) => ({
      ...prev,
      [replaceSectionId]: { phase: 'uploading', progress: 10 },
    }))
    startFakeProgress(replaceSectionId)
    try {
      const token = await getToken()
      const fd = new FormData()
      fd.append('title', replaceTitle.trim())
      fd.append('file', replaceFile)
      const res = await api.knowledge.replaceDocument(token, replaceId, fd)
      finishSectionSuccess(replaceSectionId, {
        title: res.title,
        filename: res.original_filename,
        chunks: res.chunk_count,
      })
      notifySuccess('Document updated in Pinecone.')
      cancelReplace()
      await refetch()
    } catch (e) {
      clearProgressTimer(replaceSectionId)
      setSectionState((prev) => ({
        ...prev,
        [replaceSectionId]: { phase: 'idle', progress: 0 },
      }))
      notifyError(e instanceof ApiError ? e.message : 'Replace failed')
    } finally {
      setReplacing(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this document from Pinecone and your library?')) return
    setDeletingId(id)
    try {
      const token = await getToken()
      await api.knowledge.deleteDocument(token, id)
      notifySuccess('Removed from Pinecone.')
      if (replaceId === id) cancelReplace()
      await refetch()
    } catch (e) {
      notifyError(e instanceof ApiError ? e.message : 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  const dismissSuccess = (sectionId: string) => {
    setSectionState((prev) => ({
      ...prev,
      [sectionId]: { phase: 'idle', progress: 0 },
    }))
  }

  if (loading || !data) {
    return (
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-72 animate-pulse rounded-2xl bg-gradient-to-br from-zinc-100 to-zinc-50 dark:from-zinc-800 dark:to-zinc-900"
          />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="mt-8 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 dark:border-red-900/40 dark:bg-red-950/30">
        <ExclamationTriangleIcon className="h-6 w-6 shrink-0 text-red-600 dark:text-red-400" />
        <p className="text-sm text-red-900 dark:text-red-100">{error}</p>
      </div>
    )
  }

  const { docTypes, status } = data

  return (
    <div className="mt-8 max-w-6xl space-y-8">
      {/* Status strip */}
      <div
        className={`flex flex-col gap-3 rounded-2xl border px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${
          status.rag_configured
            ? 'border-emerald-200/80 bg-gradient-to-r from-emerald-50/80 to-teal-50/50 dark:border-emerald-900/40 dark:from-emerald-950/30 dark:to-teal-950/20'
            : 'border-amber-200 bg-amber-50/80 dark:border-amber-900/40 dark:bg-amber-950/25'
        }`}
      >
        <div className="flex items-center gap-3">
          {status.rag_configured ? (
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-sm shadow-emerald-500/30">
              <SparklesIcon className="h-6 w-6" />
            </div>
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500 text-white">
              <ExclamationTriangleIcon className="h-6 w-6" />
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">
              {status.rag_configured ? 'Knowledge base online' : 'Uploads disabled'}
            </p>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              {status.rag_configured
                ? `Vectors sync to Pinecone${status.index_name ? ` · index “${status.index_name}”` : ''}. Each section below uploads into your org namespace.`
                : 'Configure PINECONE_API_KEY, INDEX_NAME, and OPENAI_API_KEY on the API server.'}
            </p>
          </div>
        </div>
        {status.rag_configured ? (
          <Badge color="green" className="w-fit shrink-0">
            Embeddings ready
          </Badge>
        ) : (
          <Badge color="amber" className="w-fit shrink-0">
            Not connected
          </Badge>
        )}
      </div>

      <div>
        <Subheading>Knowledge by category</Subheading>
        <Text className="mt-1 max-w-2xl text-sm text-zinc-500">
          One workspace per type. Upload the file that matches the category — the assistant only searches pricing docs
          when answering price questions, technical docs when troubleshooting, and so on.
        </Text>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {docTypes.map((dt) => {
          const theme = SECTION_THEME[dt.id] ?? defaultTheme
          const list = byType.get(dt.id) ?? []
          const st = sectionState[dt.id] ?? { phase: 'idle' as const, progress: 0 }
          const fileInputId = `kb-file-${dt.id}`

          return (
            <article
              key={dt.id}
              className={`relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-gradient-to-br shadow-sm ring-1 ${theme.ring} dark:border-zinc-700/60 ${theme.bg}`}
            >
              <div className="absolute right-0 top-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-white/20 blur-2xl dark:bg-white/5" />

              <div className="relative p-6">
                <div className="flex gap-4">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${theme.iconWrap}`}
                  >
                    <DocumentMagnifyingGlassIcon className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className={`text-lg font-semibold tracking-tight ${theme.label}`}>{dt.title}</h3>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{dt.short}</p>
                  </div>
                </div>

                <div className="mt-5 space-y-3 rounded-xl bg-white/60 p-4 text-sm leading-relaxed text-zinc-700 shadow-inner dark:bg-zinc-950/40 dark:text-zinc-300">
                  <p>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">Where the AI uses this · </span>
                    {dt.used_in}
                  </p>
                  <p>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">Why upload · </span>
                    {dt.why_upload}
                  </p>
                </div>

                {st.phase === 'uploading' && (
                  <div className="mt-5 space-y-2">
                    <div className="flex items-center justify-between text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      <span>Uploading & embedding into Pinecone…</span>
                      <span>{Math.round(st.progress)}%</span>
                    </div>
                    <SectionProgressBar phase="uploading" progress={st.progress} barClass={theme.bar} />
                  </div>
                )}

                {st.phase === 'success' && st.successChunks != null && (
                  <div className="mt-5 overflow-hidden rounded-xl border border-emerald-200/90 bg-gradient-to-br from-emerald-50 to-teal-50/80 shadow-sm dark:border-emerald-900/50 dark:from-emerald-950/50 dark:to-teal-950/30">
                    <div className="px-4 pt-3">
                      <div className="mb-2 flex items-center justify-between text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                        <span>Synced to Pinecone</span>
                        <span>100%</span>
                      </div>
                      <SectionProgressBar phase="success" progress={100} barClass={theme.bar} />
                    </div>
                    <div className="flex items-start gap-3 p-4 pt-3">
                      <CheckCircleSolid className="h-9 w-9 shrink-0 text-emerald-500" />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-emerald-950 dark:text-emerald-50">
                          This section is live in your vector index
                        </p>
                        <p className="mt-1 text-sm text-emerald-900/90 dark:text-emerald-100/90">
                          <span className="font-medium">{st.successTitle}</span>
                          {st.successFilename ? (
                            <>
                              {' '}
                              · <span className="opacity-90">{st.successFilename}</span>
                            </>
                          ) : null}
                        </p>
                        <p className="mt-2 text-xs leading-relaxed text-emerald-800 dark:text-emerald-200/90">
                          {st.successChunks} chunk{st.successChunks === 1 ? '' : 's'} indexed — your assistant can
                          search this content in the next customer chat.
                        </p>
                        <button
                          type="button"
                          onClick={() => dismissSuccess(dt.id)}
                          className="mt-3 text-xs font-medium text-emerald-800 underline decoration-emerald-500/50 underline-offset-2 hover:text-emerald-950 dark:text-emerald-300 dark:hover:text-white"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-5 space-y-4">
                  <Field>
                    <Label className="text-zinc-800 dark:text-zinc-200">Document title</Label>
                    <Description>Internal label only — e.g. “2025 tune-up menu”.</Description>
                    <Input
                      value={titles[dt.id] ?? ''}
                      onChange={(e) => setTitles((prev) => ({ ...prev, [dt.id]: e.target.value }))}
                      placeholder={`Name this ${dt.title.toLowerCase()} file…`}
                      disabled={!status.rag_configured || st.phase === 'uploading'}
                    />
                  </Field>

                  <Field>
                    <Label className="text-zinc-800 dark:text-zinc-200">File</Label>
                    <Description>PDF, DOCX, PPTX, HTML, or TXT — max ~25 MB.</Description>
                    <div data-slot="control" className="mt-2">
                      <label
                        htmlFor={fileInputId}
                        onDragEnter={(e) => {
                          e.preventDefault()
                          if (status.rag_configured && st.phase !== 'uploading') setDragOverId(dt.id)
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault()
                          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverId(null)
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault()
                          setDragOverId(null)
                          if (!status.rag_configured || st.phase === 'uploading') return
                          const f = e.dataTransfer.files?.[0]
                          if (f) setFiles((prev) => ({ ...prev, [dt.id]: f }))
                        }}
                        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 transition-colors ${
                          status.rag_configured && st.phase !== 'uploading'
                            ? dragOverId === dt.id
                              ? 'border-emerald-400 bg-emerald-50/80 dark:border-emerald-500/50 dark:bg-emerald-950/30'
                              : 'border-zinc-300 bg-white/50 hover:border-zinc-400 hover:bg-white/80 dark:border-zinc-600 dark:bg-zinc-950/30 dark:hover:border-zinc-500'
                            : 'cursor-not-allowed border-zinc-200 bg-zinc-50/50 opacity-60 dark:border-zinc-800 dark:bg-zinc-900/50'
                        }`}
                      >
                        <CloudArrowUpIcon className="mb-2 h-10 w-10 text-zinc-400" />
                        <span className="text-center text-sm font-medium text-zinc-700 dark:text-zinc-300">
                          {files[dt.id] ? files[dt.id]!.name : 'Drop a file or click to browse'}
                        </span>
                        <input
                          id={fileInputId}
                          type="file"
                          accept=".pdf,.docx,.pptx,.html,.htm,.txt"
                          className="sr-only"
                          disabled={!status.rag_configured || st.phase === 'uploading'}
                          onChange={(e) =>
                            setFiles((prev) => ({ ...prev, [dt.id]: e.target.files?.[0] ?? null }))
                          }
                        />
                      </label>
                    </div>
                  </Field>

                  <Button
                    type="button"
                    onClick={() => handleSectionUpload(dt.id)}
                    disabled={!status.rag_configured || st.phase === 'uploading'}
                    className="w-full sm:w-auto"
                  >
                    {st.phase === 'uploading' ? (
                      <>
                        <ArrowPathIcon className="mr-2 h-4 w-4 animate-spin" />
                        Processing…
                      </>
                    ) : (
                      <>
                        <CloudArrowUpIcon className="mr-2 h-4 w-4" />
                        Upload to Pinecone
                      </>
                    )}
                  </Button>
                </div>

                {list.length > 0 && (
                  <div className="mt-8 border-t border-zinc-200/80 pt-6 dark:border-zinc-700/60">
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      Uploaded in this category ({list.length})
                    </p>
                    <ul className="mt-3 space-y-2">
                      {list.map((doc) => (
                        <li
                          key={doc.id}
                          className="flex flex-col gap-3 rounded-lg border border-zinc-200/80 bg-white/70 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-700/50 dark:bg-zinc-950/50"
                        >
                          {replaceId === doc.id ? (
                            <div className="w-full space-y-3">
                              <p className="text-sm font-medium text-zinc-900 dark:text-white">Replace file</p>
                              <Input
                                value={replaceTitle}
                                onChange={(e) => setReplaceTitle(e.target.value)}
                                disabled={replacing}
                              />
                              <input
                                type="file"
                                accept=".pdf,.docx,.pptx,.html,.htm,.txt"
                                disabled={replacing}
                                className="block w-full text-xs text-zinc-600 file:mr-2 file:rounded file:border-0 file:bg-zinc-100 file:px-2 file:py-1 dark:file:bg-zinc-800"
                                onChange={(e) => setReplaceFile(e.target.files?.[0] ?? null)}
                              />
                              <div className="flex gap-2">
                                <Button type="button" onClick={handleReplace} disabled={replacing}>
                                  {replacing ? 'Saving…' : 'Save'}
                                </Button>
                                <Button type="button" color="zinc" onClick={cancelReplace} disabled={replacing}>
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-medium text-zinc-900 dark:text-white">{doc.title}</p>
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                                    <CheckCircleIcon className="h-3 w-3" />
                                    In Pinecone
                                  </span>
                                </div>
                                <p className="mt-0.5 text-xs text-zinc-500">
                                  {doc.original_filename} · {doc.chunk_count} chunks ·{' '}
                                  {new Date(doc.updated_at).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="flex shrink-0 gap-2">
                                <Button
                                  type="button"
                                  color="zinc"
                                  onClick={() => startReplace(doc)}
                                  disabled={!status.rag_configured || deletingId === doc.id}
                                >
                                  Replace
                                </Button>
                                <Button
                                  type="button"
                                  color="red"
                                  onClick={() => handleDelete(doc.id)}
                                  disabled={deletingId === doc.id || !status.rag_configured}
                                >
                                  <TrashIcon className="h-4 w-4" />
                                </Button>
                              </div>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
