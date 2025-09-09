import { TAGMCSInstance } from "./main.js";

export const DEFAULT_MIN_COMMAND_GAP_MS = 800 // min time between commands
export const DEFAULT_POST_WRITE_SETTLE_MS = 200 // time to wait after a write

function sleep(ms: number) {
	return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

type CommandFn<T = any> = () => Promise<T>

export async function scheduleCommand<T = any>(
	instance: TAGMCSInstance,
	fn: CommandFn<T>,
	opts?: { minGapMs?: number; settleMs?: number; tag?: string },
): Promise<T> {
	const minGap = opts?.minGapMs ?? instance.config?.queuedCommandDelay ?? DEFAULT_MIN_COMMAND_GAP_MS
	const settle = opts?.settleMs ?? DEFAULT_POST_WRITE_SETTLE_MS

	// Create a chain promise to ensure FIFO execution
	if (!instance._commandChain) {
		instance._commandChain = Promise.resolve()
	}
	if (!instance._lastCommandAt) {
		instance._lastCommandAt = 0
	}

	// Chain the work
	const task = (async () => {
		const now = Date.now()
		const since = now - (instance._lastCommandAt || 0)
		const waitMs = since >= minGap ? 0 : minGap - since

		if (waitMs > 0 && instance.config?.verbose) {
			instance.log('debug', `Command gate: waiting ${waitMs}ms (${opts?.tag ?? 'cmd'})`)
		}

		if (waitMs > 0) await sleep(waitMs)

		// Run the actual command
		const result = await fn()

		// Stamp last command time and apply settle delay after successful write(s)
		instance._lastCommandAt = Date.now()
		if (settle > 0) {
			if (instance.config?.verbose) {
				instance.log('debug', `Command settle: waiting ${settle}ms (${opts?.tag ?? 'cmd'})`)
			}
			await sleep(settle)
		}

		return result
	})()

	// Serialize: append to the chain, but return the real task result
	const chained = instance._commandChain.then(() => task)
	instance._commandChain = chained.catch(() => {}) // keep chain alive even on failure
	return chained
}
