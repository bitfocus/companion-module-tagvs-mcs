import { TAGMCSInstance } from './main.js'

export const DEFAULT_MIN_COMMAND_GAP_MS = 800 // min time between commands
export const DEFAULT_POST_WRITE_SETTLE_MS = 200 // time to wait after a write

/*
function sleep(ms: number) {
	return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

type CommandFn<T = any> = () => Promise<T>
*/

export async function scheduleCommand<T = any>(
  instance: TAGMCSInstance, // TAGMCSInstance at runtime
  fn: () => Promise<T>,
  opts?: { minGapMs?: number; settleMs?: number; tag?: string }
): Promise<T> {
  const minGap = opts?.minGapMs ?? instance.config?.queuedCommandDelay ?? 500
  const settle = opts?.settleMs ?? 250
  const tag = opts?.tag ?? 'cmd'

  // init chain + clock
  if (!instance._commandChain) instance._commandChain = Promise.resolve()
  if (!instance._lastCommandAt) instance._lastCommandAt = 0

  // Build the next link in the chain. IMPORTANT: create the async work INSIDE the .then()
  const next = instance._commandChain.then(async () => {
    const now = Date.now()
    const since = now - (instance._lastCommandAt || 0)
    const waitMs = since >= minGap ? 0 : (minGap - since)

    if (waitMs > 0 && instance.config?.verbose) {
      instance.log('debug', `Command gate: waiting ${waitMs}ms (${tag})`)
    }
    if (waitMs > 0) await new Promise(r => setTimeout(r, waitMs))

    // Run the actual command
    const result = await fn()

    // Stamp and settle
    instance._lastCommandAt = Date.now()
    if (settle > 0) {
      if (instance.config?.verbose) instance.log('debug', `Command settle: waiting ${settle}ms (${tag})`)
      await new Promise(r => setTimeout(r, settle))
    }

    return result
  })

  // Keep the chain alive even if this task throws, so later tasks still run
  instance._commandChain = next.catch((e: any) => {
    // optional: log once
    if (instance.config?.verbose) instance.log('debug', `Command error (${tag}): ${e}`)
  })

  // Return the actual task promise (propagates result/errors to caller)
  return next
}
