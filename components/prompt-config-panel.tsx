'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/button'
import { Badge } from '@/components/badge'
import { Text } from '@/components/text'
import { Textarea } from '@/components/textarea'
import { useApiData, useApiToken } from '@/lib/hooks'
import { ApiError } from '@/lib/api'
import { notifyError, notifySuccess } from '@/lib/notify'
import type { PromptConfig } from '@/lib/types'

export type PromptApiAdapter = {
  list: (token: string) => Promise<PromptConfig[]>
  update: (token: string, nodeKey: string, promptText: string) => Promise<PromptConfig>
  reset: (token: string, nodeKey: string) => Promise<PromptConfig>
  resetAll: (token: string) => Promise<{ reset_count: number; status: string }>
}

export function PromptConfigPanel({ api: promptsApi }: { api: PromptApiAdapter }) {
  const getToken = useApiToken()
  const { data: prompts, loading, refetch } = useApiData<PromptConfig[]>(
    (token) => promptsApi.list(token),
  )

  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [resettingKey, setResettingKey] = useState<string | null>(null)
  const [resettingAll, setResettingAll] = useState(false)

  useEffect(() => {
    if (prompts) {
      const initial: Record<string, string> = {}
      for (const p of prompts) initial[p.node_key] = p.prompt_text
      setDrafts(initial)
    }
  }, [prompts])

  const handleSave = async (nodeKey: string) => {
    const text = drafts[nodeKey]
    if (text === undefined) return
    setSavingKey(nodeKey)
    try {
      const token = await getToken()
      await promptsApi.update(token, nodeKey, text)
      notifySuccess(`Prompt "${nodeKey}" saved`)
      refetch()
    } catch (e) {
      notifyError(e instanceof ApiError ? e.message : 'Could not save prompt')
    } finally {
      setSavingKey(null)
    }
  }

  const handleReset = async (prompt: PromptConfig) => {
    const nodeKey = prompt.node_key
    const defaultText = prompt.default_prompt_text ?? prompt.prompt_text
    setResettingKey(nodeKey)
    try {
      if (prompt.is_custom) {
        const token = await getToken()
        const result = await promptsApi.reset(token, nodeKey)
        setDrafts((prev) => ({
          ...prev,
          [nodeKey]: result.default_prompt_text ?? result.prompt_text,
        }))
        notifySuccess(`Prompt "${nodeKey}" reset to default`)
        refetch()
      } else {
        setDrafts((prev) => ({ ...prev, [nodeKey]: defaultText }))
        notifySuccess(`Prompt "${nodeKey}" restored to default`)
      }
    } catch (e) {
      notifyError(e instanceof ApiError ? e.message : 'Could not reset prompt')
    } finally {
      setResettingKey(null)
    }
  }

  const handleResetAll = async () => {
    setResettingAll(true)
    try {
      const token = await getToken()
      await promptsApi.resetAll(token)
      notifySuccess('All prompts reset to defaults')
      refetch()
    } catch (e) {
      notifyError(e instanceof ApiError ? e.message : 'Could not reset prompts')
    } finally {
      setResettingAll(false)
    }
  }

  if (loading || !prompts) {
    return (
      <div className="mt-8 space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-48 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        ))}
      </div>
    )
  }

  const hasAnyCustom = prompts.some((p) => p.is_custom)

  return (
    <div className="mt-8 max-w-4xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <Text className="text-sm text-zinc-500">
            Customize the system prompts used by each AI node. Use placeholders like{' '}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">{'{{INDUSTRY}}'}</code>,{' '}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">{'{{SERVICE_LIST}}'}</code>,{' '}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">{'{{SERVICE_AREAS}}'}</code>,{' '}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">{'{{BUSINESS_HOURS}}'}</code>{' '}
            — they are replaced automatically with your tenant config values.
          </Text>
        </div>
        {hasAnyCustom && (
          <Button
            type="button"
            color="zinc"
            onClick={handleResetAll}
            disabled={resettingAll}
          >
            {resettingAll ? 'Resetting...' : 'Reset all to defaults'}
          </Button>
        )}
      </div>

      {prompts.map((prompt) => {
        const defaultText = prompt.default_prompt_text ?? prompt.prompt_text
        const draft = drafts[prompt.node_key] ?? prompt.prompt_text
        const isModified = draft !== prompt.prompt_text
        const isAtDefault = draft === defaultText && !prompt.is_custom
        const isSaving = savingKey === prompt.node_key
        const isResetting = resettingKey === prompt.node_key
        const canReset = prompt.is_custom || draft !== defaultText

        return (
          <div
            key={prompt.node_key}
            className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700/50 dark:bg-zinc-900"
          >
            <div className="mb-3 flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                    {prompt.label}
                  </h3>
                  {prompt.is_custom ? (
                    <Badge color="blue">Custom</Badge>
                  ) : (
                    <Badge color="zinc">Default</Badge>
                  )}
                </div>
                <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  {prompt.description}
                </p>
                <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
                  Node key:{' '}
                  <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-800">
                    {prompt.node_key}
                  </code>
                </p>
              </div>
              <Button
                type="button"
                color="zinc"
                onClick={() => handleReset(prompt)}
                disabled={isResetting || !canReset}
                className="shrink-0"
              >
                {isResetting ? 'Resetting...' : 'Reset'}
              </Button>
            </div>

            <Textarea
              value={draft}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setDrafts((prev) => ({ ...prev, [prompt.node_key]: e.target.value }))
              }
              rows={10}
              className="font-mono text-xs"
              resizable
            />

            <div className="mt-3 flex items-center gap-3">
              <Button
                type="button"
                onClick={() => handleSave(prompt.node_key)}
                disabled={isSaving || (!isModified && !prompt.is_custom && isAtDefault)}
              >
                {isSaving ? 'Saving...' : 'Save prompt'}
              </Button>
              {isModified && (
                <span className="text-xs text-amber-600 dark:text-amber-400">Unsaved changes</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
