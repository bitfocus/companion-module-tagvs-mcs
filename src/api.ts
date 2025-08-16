import { InstanceStatus } from '@companion-module/base'
import { TAGMCSInstance } from './main.js'
import { Agent, setGlobalDispatcher } from 'undici'

type Tokens = {
	accessToken: string | null
	refreshToken: string | null
	exp: number // unix seconds
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

export async function applyLayout(instance: TAGMCSInstance, outputUuid: string, layoutUuid: string): Promise<void> {
	if (instance.config.verbose) {
		instance.log('debug', `applyLayout called with outputUuid=${outputUuid}, layoutUuid=${layoutUuid}`)
	}

	// Use the cached full object (from getState)
	const current = instance.outputs?.find((o: any) => o.uuid === outputUuid)
	if (!current) {
		instance.log('error', `Cannot Apply Layout: output ${outputUuid} not found`)
		return
	}

	const outputLabel = instance.outputChoices.find((o) => o.id === outputUuid)?.label || ''
	const layoutLabel = instance.layoutChoices.find((l) => l.id === layoutUuid)?.label || ''
	instance.log('info', `Applying layout "${layoutLabel}" to output "${outputLabel}"`)

	// Deep clone to avoid mutating cache
	const next = JSON.parse(JSON.stringify(current))
	next.input = next.input || {}
	next.input.layouts = [layoutUuid]
	await fetchJson(instance as any, `outputs/config/${outputUuid}`, 'PUT', next)
}
