import type { TAGMCSInstance } from './main.js'
import { ensureAccess, readTokens, refresh } from './login.js'
import { Agent, setGlobalDispatcher } from 'undici'

export function BuildBaseUrl(config: { ip: string; port: number }) {
	setGlobalDispatcher(new Agent({ connect: { rejectUnauthorized: false } }))

	if (config.port !== 443) {
		return `https://${config.ip}:${config.port}/api/5.0`
	}

	return `https://${config.ip}/api/5.0`
}

export function BuildOutputChoices(instance: TAGMCSInstance): Array<{ id: string; label: string }> {
	const arr = Array.isArray(instance.outputs) ? instance.outputs : []
	return arr.map((o: any) => ({
		id: o.uuid,
		label: o.label || o.uuid,
	}))
}

export function BuildLayoutChoices(instance: TAGMCSInstance): Array<{ id: string; label: string }> {
	const arr = Array.isArray(instance.layouts) ? instance.layouts : []
	return arr.map((l: any) => ({
		id: l.uuid,
		label: l.label || l.uuid,
	}))
}

export function BuildChannelChoices(instance: TAGMCSInstance): Array<{ id: string; label: string }> {
	const arr = Array.isArray(instance.channels) ? instance.channels : []
	return arr.map((c: any) => ({
		id: c.uuid,
		label: c.label || c.uuid,
	}))
}

export async function safeJson(res: Response): Promise<any> {
	try {
		return await res.json()
	} catch {
		return null
	}
}

export async function rawFetch(instance: TAGMCSInstance, url: string, method: string, body?: any): Promise<Response> {
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
		//if (body !== undefined) instance.log('debug', `Payload: ${JSON.stringify(body)}`)
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
	verbose: boolean = true, // log request and errors, but only if instance.config.verbose - used to keep the polling quiet
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

	if (instance.config.verbose && verbose) {
		instance.log('debug', `[${method}] ${url}`)
		//if (body !== undefined) instance.log('debug', `Payload: ${JSON.stringify(body)}`)
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
