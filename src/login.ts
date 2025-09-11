import { InstanceStatus } from '@companion-module/base'
import type { TAGMCSInstance } from './main.js'
import { rawFetch, safeJson } from './utils.js'

type Tokens = {
	accessToken: string | null
	refreshToken: string | null
	exp: number // unix seconds
}

export async function login(instance: TAGMCSInstance): Promise<void> {
	const url = `${(instance as any).baseUrl}/auth/login`
	const body = { username: instance.config.username, password: instance.config.password }

    try {
        const res = await rawFetch(instance, url, 'POST', body)
        const json = await safeJson(res)

        if (!json?.data?.access_token || !json?.data?.refresh_token) {
            throw new Error('Login did not return tokens')
        }

        const access = String(json.data.access_token)
        const refresh = String(json.data.refresh_token)
        const exp = decodeJwtExp(access)

        writeTokens(instance, { accessToken: access, refreshToken: refresh, exp })
        if (instance.config.verbose) {
            instance.log('debug', `Login success; access exp @ ${exp}`)
        }

        instance.updateStatus(InstanceStatus.Ok)
    } catch (error: any) {
        //if fetch failed, network error, etc
        instance.updateStatus(InstanceStatus.ConnectionFailure, 'Login failed - check configuration')
        instance.log('debug', `Login failed - check configuration for correct IP/Port and credentials.`)
        if (instance.config.verbose) {
            instance.log('debug', `Login failed: ${String(error)}`)
        }
    }
}

export function readTokens(instance: TAGMCSInstance): Tokens {
	return ((instance as any)._tokens ?? { accessToken: null, refreshToken: null, exp: 0 }) as Tokens
}

export function writeTokens(instance: TAGMCSInstance, t: Tokens) {
	;(instance as any)._tokens = t
}

function decodeJwtExp(jwt: string): number {
	// decode without verification; we just need exp to preempt refresh
	const parts = jwt.split('.')
	if (parts.length < 2) return 0
	const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'))
	return Number(payload?.exp ?? 0)
}

export async function refresh(instance: TAGMCSInstance): Promise<void> {
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

export async function ensureAccess(instance: TAGMCSInstance): Promise<void> {
	const t = readTokens(instance)
	// refresh a little early (30s skew)
	if (!t.accessToken || (t.exp || 0) - nowSeconds() <= 30) {
		await (t.refreshToken ? refresh(instance) : login(instance))
	}
}

function nowSeconds() {
	return Math.floor(Date.now() / 1000)
}
