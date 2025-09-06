import { InstanceStatus } from '@companion-module/base'
import { TAGMCSInstance } from './main.js'
import { Agent, setGlobalDispatcher } from 'undici'

type Tokens = {
	accessToken: string | null
	refreshToken: string | null
	exp: number // unix seconds
}

export const DEFAULT_MIN_COMMAND_GAP_MS = 500 // min time between commands
export const DEFAULT_POST_WRITE_SETTLE_MS = 200 // time to wait after a write

function sleep(ms: number) {
	return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

type CommandFn<T = any> = () => Promise<T>

export async function scheduleCommand<T = any>(
	instance: any,
	fn: CommandFn<T>,
	opts?: { minGapMs?: number; settleMs?: number; tag?: string },
): Promise<T> {
	const minGap = opts?.minGapMs ?? DEFAULT_MIN_COMMAND_GAP_MS
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
		const since = now - instance._lastCommandAt
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

function nowSeconds() {
	return Math.floor(Date.now() / 1000)
}

function BuildBaseUrl(config: { ip: string; port: number }) {
	setGlobalDispatcher(new Agent({ connect: { rejectUnauthorized: false } }))

	if (config.port !== 443) {
		return `https://${config.ip}:${config.port}/api/5.0`
	}

	return `https://${config.ip}/api/5.0`
}

export async function InitConnection(instance: TAGMCSInstance): Promise<void> {
	if (!instance.config.ip || !instance.config.port || !instance.config.username || !instance.config.password) {
		instance.log('error', 'Missing configuration: IP, port, username, or password')
		return
	}

	instance.baseUrl = BuildBaseUrl(instance.config)

	if (instance.config.verbose) {
		instance.log('debug', `Base URL set to ${instance.baseUrl}`)
	}

	await login(instance)
	await getState(instance)
	StartPolling(instance, instance.config.pollingRate || 5000)
}

async function login(instance: TAGMCSInstance): Promise<void> {
	const url = `${(instance as any).baseUrl}/auth/login`
	const body = { username: instance.config.username, password: instance.config.password }

	const res = await rawFetch(instance, url, 'POST', body)
	const json = await safeJson(res)

	if (!json?.data?.access_token || !json?.data?.refresh_token) {
		throw new Error('Login did not return tokens')
	}

	const access = String(json.data.access_token)
	const refresh = String(json.data.refresh_token)
	const exp = decodeJwtExp(access)

	writeTokens(instance, { accessToken: access, refreshToken: refresh, exp })
	if (instance.config.verbose) instance.log('debug', `Login success; access exp @ ${exp}`)
	instance.updateStatus(InstanceStatus.Ok)
}

function readTokens(instance: TAGMCSInstance): Tokens {
	return ((instance as any)._tokens ?? { accessToken: null, refreshToken: null, exp: 0 }) as Tokens
}

function writeTokens(instance: TAGMCSInstance, t: Tokens) {
	;(instance as any)._tokens = t
}

function decodeJwtExp(jwt: string): number {
	// decode without verification; we just need exp to preempt refresh
	const parts = jwt.split('.')
	if (parts.length < 2) return 0
	const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'))
	return Number(payload?.exp ?? 0)
}

async function refresh(instance: TAGMCSInstance): Promise<void> {
	const t = readTokens(instance)
	if (!t.refreshToken) {
		if (instance.config.verbose) instance.log('debug', 'No refresh token; logging in')
		await login(instance)
		return
	}

	const url = `${(instance as any).baseUrl}/auth/token/refresh`
	const body = { refresh_token: t.refreshToken }

	const res = await rawFetch(instance, url, 'POST', body)
	if (!res.ok) {
		if (instance.config.verbose) instance.log('debug', `Refresh failed (${res.status}); logging in`)
		await login(instance)
		return
	}
	const json = await safeJson(res)
	if (!json?.data?.access_token || !json?.data?.refresh_token) {
		if (instance.config.verbose) instance.log('debug', 'Refresh missing tokens; logging in')
		await login(instance)
		return
	}

	const access = String(json.data.access_token)
	const refreshTk = String(json.data.refresh_token)
	const exp = decodeJwtExp(access)
	writeTokens(instance, { accessToken: access, refreshToken: refreshTk, exp })

	if (instance.config.verbose) instance.log('debug', `Refresh success; access exp @ ${exp}`)
}

async function ensureAccess(instance: TAGMCSInstance): Promise<void> {
	const t = readTokens(instance)
	// refresh a little early (30s skew)
	if (!t.accessToken || (t.exp || 0) - nowSeconds() <= 30) {
		await (t.refreshToken ? refresh(instance) : login(instance))
	}
}

async function safeJson(res: Response): Promise<any> {
	try {
		return await res.json()
	} catch {
		return null
	}
}

async function rawFetch(instance: TAGMCSInstance, url: string, method: string, body?: any): Promise<Response> {
	const headers: Record<string, string> = {
		accept: 'application/json',
		'content-type': 'application/json',
	}

	const options: RequestInit = {
		method,
		headers,
	}

	if (body !== undefined) options.body = JSON.stringify(body)
	if (instance.config.verbose) {
		instance.log('debug', `[${method}] ${url}`)
		if (body !== undefined) instance.log('debug', `Payload: ${JSON.stringify(body)}`)
	}

	const res = await fetch(url, options)
	return res
}

/**
 * fetchJson:
 *  - Ensures an access token
 *  - Sends Bearer token
 *  - On 401, attempts refresh() then retries once
 */
export async function fetchJson(
	instance: TAGMCSInstance,
	path: string,
	method: string = 'GET',
	body?: any,
): Promise<any> {
	await ensureAccess(instance)

	const t = readTokens(instance)
	const url = `${(instance as any).baseUrl}/${path}`

	const headers: Record<string, string> = {
		accept: 'application/json',
		'content-type': 'application/json',
		authorization: `Bearer ${t.accessToken}`,
	}

	const options: RequestInit = {
		method,
		headers,
		// no dispatcher, no redirect here -> avoid TS type conflicts
	}

	if (body !== undefined) options.body = JSON.stringify(body)

	if (instance.config.verbose) {
		instance.log('debug', `[${method}] ${url}`)
		if (body !== undefined) instance.log('debug', `Payload: ${JSON.stringify(body)}`)
	}

	let res = await fetch(url, options)

	// Handle redirect explicitly (auth won't carry across origins)
	if (res.status >= 300 && res.status < 400) {
		const loc = res.headers.get('location') || ''
		throw new Error(`Redirected (${res.status}) to: ${loc}. Point config to the correct scheme/port.`)
	}

	// If unauthorized, try refresh once
	if (res.status === 401) {
		if (instance.config.verbose) instance.log('debug', '401 received; attempting token refresh')
		await refresh(instance)
		const t2 = readTokens(instance)
		options.headers = {
			...headers,
			authorization: `Bearer ${t2.accessToken}`,
		}
		res = await fetch(url, options)
	}

	if (!res.ok) {
		let text = ''
		try {
			text = await res.text()
		} catch {}
		instance.log('error', `${method} ${path} failed: ${res.status} ${res.statusText} ${text}`.trim())
		throw new Error(`${method} ${path} failed: ${res.status}`)
	}

	const json = await res.json()
	//if (instance.config.verbose) instance.log('debug', `Response: ${JSON.stringify(json)}`)
	return json
}

export async function getState(instance: TAGMCSInstance): Promise<void> {
	try {
		const outputs = await fetchJson(instance, 'outputs/config/')
		const layouts = await fetchJson(instance, 'layouts/config/')
		const channels = await fetchJson(instance, 'channels/config/')

		instance.outputs = Array.isArray(outputs) ? outputs : outputs?.data || []
		instance.layouts = Array.isArray(layouts) ? layouts : layouts?.data || []
		instance.channels = Array.isArray(channels) ? channels : channels?.data || []

		//compare these choices to existing ones, and only rebuild if changed
		const outputChoices = BuildOutputChoices(instance)
		const layoutChoices = BuildLayoutChoices(instance)
		const channelChoices = BuildChannelChoices(instance)

		let changed = false
		if (JSON.stringify(outputChoices) !== JSON.stringify(instance.outputChoices)) {
			instance.outputChoices = outputChoices
			changed = true
		}
		if (JSON.stringify(layoutChoices) !== JSON.stringify(instance.layoutChoices)) {
			instance.layoutChoices = layoutChoices
			changed = true
		}
		if (JSON.stringify(channelChoices) !== JSON.stringify(instance.channelChoices)) {
			instance.channelChoices = channelChoices
			changed = true
		}

		if (changed) {
			instance.log('debug', 'Choices changed; updating actions')
			instance.updateActions()
			instance.updateVariableDefinitions()
			instance.updateFeedbacks()
		}

		instance.setVariableValues({
			output_count: instance.outputs.length,
			layout_count: instance.layouts.length,
			channel_count: instance.channels.length,
		})

		instance.updateVariables()
		instance.checkFeedbacks()
	} catch (e) {
		instance.log('error', `Polling error: ${e}`)
		console.log(e)
		StopPolling(instance)
	}
}

function BuildOutputChoices(instance: TAGMCSInstance): Array<{ id: string; label: string }> {
	const arr = Array.isArray(instance.outputs) ? instance.outputs : []
	return arr.map((o: any) => ({
		id: o.uuid,
		label: o.label || o.uuid,
	}))
}

function BuildLayoutChoices(instance: TAGMCSInstance): Array<{ id: string; label: string }> {
	const arr = Array.isArray(instance.layouts) ? instance.layouts : []
	return arr.map((l: any) => ({
		id: l.uuid,
		label: l.label || l.uuid,
	}))
}

function BuildChannelChoices(instance: TAGMCSInstance): Array<{ id: string; label: string }> {
	const arr = Array.isArray(instance.channels) ? instance.channels : []
	return arr.map((c: any) => ({
		id: c.uuid,
		label: c.label || c.uuid,
	}))
}

export function StartPolling(instance: TAGMCSInstance, interval = 5000): void {
	if (instance.pollInterval) {
		clearInterval(instance.pollInterval)
	}

	if (instance.config.verbose) {
		instance.log('debug', `Starting polling every ${interval} ms`)
	}

	instance.pollInterval = setInterval(() => {
		getState(instance).catch((err) => {
			instance.log('error', `Polling failed: ${err}`)
			console.log(err)
			StopPolling(instance)
		})
	}, interval)
}

export function StopPolling(instance: TAGMCSInstance): void {
	if (instance.config.verbose) {
		instance.log('debug', 'Stopping polling')
	}

	if (instance.pollInterval) {
		clearInterval(instance.pollInterval)
		instance.pollInterval = undefined
	}
}

export async function modifyLayout(
	instance: TAGMCSInstance,
	layoutUuid: string,
	tileNumber: Number,
	videoChannelUuid: string,
): Promise<void> {
	if (instance.config.verbose) {
		instance.log(
			'debug',
			`modifyLayout called with layoutUuid=${layoutUuid}, tileNumber=${tileNumber}, videoChannelUuid=${videoChannelUuid}`,
		)
	}

	await scheduleCommand(
		instance,
		async () => {
			// Fetch the current layout configuration
			let layout = await getLayout(instance, layoutUuid)

			if (!layout) {
				instance.log('error', `Cannot Modify Layout: Layout ${layoutUuid} not found`)
				return
			}

			//get the layout label
			const layoutLabel = instance.layoutChoices.find((l) => l.id === layoutUuid)?.label || ''

			//get the channel label
			const channelLabel = instance.channelChoices.find((c) => c.id === videoChannelUuid)?.label || ''

			const next = JSON.parse(JSON.stringify(layout))
			next.tiles = next.tiles || []
			//find the tile object by doing a find in next.tiles for tile.index == tileNumber
			const tile = next.tiles.find((t: any) => t.index === tileNumber)
			if (!tile) {
				instance.log('error', `Cannot Modify Layout: Tile Number ${tileNumber} not found in Layout "${layoutLabel}"`)
				return
			}

			tile.channel = videoChannelUuid
			if (instance.config.verbose) {
				instance.log('debug', `Modifying layout "${layoutLabel}" tile ${tileNumber} to video channel "${channelLabel}"`)
			}

			// Update the layout in the API
			await fetchJson(instance as any, `layouts/config/${layoutUuid}`, 'PUT', next)
		},
		{ tag: 'modifyLayout' },
	)
}

export async function applyLayout(instance: TAGMCSInstance, outputUuid: string, layoutUuid: string): Promise<void> {
	if (instance.config.verbose) {
		instance.log('debug', `applyLayout called with outputUuid=${outputUuid}, layoutUuid=${layoutUuid}`)
	}

	await scheduleCommand(
		instance,
		async () => {
			let current = await getOutput(instance, outputUuid)

			if (!current) {
				instance.log('error', `Cannot Apply Layout: output ${outputUuid} not found`)
				return
			}

			const outputLabel = instance.outputChoices.find((o) => o.id === outputUuid)?.label || ''
			const layoutLabel = instance.layoutChoices.find((l) => l.id === layoutUuid)?.label || ''
			instance.log('info', `Applying layout "${layoutLabel}" to output "${outputLabel}"`)

			// Deep clone to avoid mutating cache
			const next = JSON.parse(JSON.stringify(current.data))
			next.input = next.input || {}
			next.input.layouts = [layoutUuid]

			// Update the output's layout in the API
			await fetchJson(instance as any, `outputs/config/${outputUuid}`, 'PUT', next)
		},
		{ tag: 'applyLayout' },
	)
}

export async function setAudioChannel(
	instance: TAGMCSInstance,
	outputUuid: string,
	channelUuid: string,
	audioIndex: number = 1,
): Promise<void> {
	if (instance.config.verbose) {
		instance.log(
			'debug',
			`setAudioChannel called with outputUuid=${outputUuid}, channelUuid=${channelUuid}, audioIndex=${audioIndex}`,
		)
	}

	await scheduleCommand(
		instance,
		async () => {
			// Fetch the current output configuration
			let current = await getOutput(instance, outputUuid)

			if (!current) {
				instance.log('error', `Cannot Set Audio Channel: output ${outputUuid} not found`)
				return
			}

			const outputLabel = instance.outputChoices.find((o) => o.id === outputUuid)?.label || ''
			const channelLabel = instance.channelChoices.find((c) => c.id === channelUuid)?.label || ''
			instance.log(
				'info',
				`Setting audio channel "${channelLabel}" on output "${outputLabel}" (audio index ${audioIndex})`,
			)

			// Deep clone to avoid mutating cache
			const next = JSON.parse(JSON.stringify(current.data))
			next.input = next.input || {}
			next.input.audio = next.input.audio || []

			//find entry where next.input.audio.index == 1, or create it if not found
			let audioEntry = next.input.audio.find((a: any) => a.index === 1)
			if (!audioEntry) {
				audioEntry = { index: 1, channel: '', pid: null }
				next.input.audio.push(audioEntry)
			}

			audioEntry.channel = channelUuid
			audioEntry.audio_index = audioIndex

			// Update the output's audio channel in the API
			await fetchJson(instance as any, `outputs/config/${outputUuid}`, 'PUT', next)
		},
		{ tag: 'setAudioChannel' },
	)
}

async function getOutput(instance: TAGMCSInstance, uuid: string): Promise<any> {
	return fetchJson(instance, `outputs/config/${uuid}`, 'GET')
}

async function getLayout(instance: TAGMCSInstance, uuid: string): Promise<any> {
	return fetchJson(instance, `layouts/config/${uuid}`, 'GET')
}
