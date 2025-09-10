import { InstanceStatus } from '@companion-module/base'
import type { TAGMCSInstance } from './main.js'
import { login } from './login.js'

import { BuildBaseUrl, fetchJson } from './utils.js'
import { StartPolling, getState } from './polling.js'
import { scheduleCommand, DEFAULT_MIN_COMMAND_GAP_MS } from './scheduling.js'

export async function InitConnection(instance: TAGMCSInstance): Promise<void> {
	if (!instance.config.ip || !instance.config.port || !instance.config.username || !instance.config.password) {
		instance.updateStatus(InstanceStatus.BadConfig, 'Missing configuration: IP, port, username, or password')
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

	let minGapMs = instance.config.queuedCommandDelay || DEFAULT_MIN_COMMAND_GAP_MS

	if (instance.config.useQueuedCommands == false) {
		minGapMs = 0
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

			const next = JSON.parse(JSON.stringify(layout.data))
			
			next.tiles = next.tiles || []
			//find the tile object by doing a find in next.tiles for tile.index == tileNumber
			const tile = next.tiles.find((t: any) => t.index === tileNumber)
			if (!tile) {
				instance.log('debug', `Cannot Modify Layout: Tile Number ${tileNumber} not found in Layout "${layoutLabel}"`)
				return
			}

			tile.channel = videoChannelUuid

			instance.log('info', `Modifying layout "${layoutLabel}" tile ${tileNumber} to video channel "${channelLabel}"`)

			// Update the layout in the API
			await fetchJson(instance as TAGMCSInstance, true, `layouts/config/${layoutUuid}`, 'PUT', next)
		},
		{ tag: 'modifyLayout', minGapMs: minGapMs },
	)
}

export async function applyLayout(instance: TAGMCSInstance, outputUuid: string, layoutUuid: string): Promise<void> {
	if (instance.config.verbose) {
		instance.log('debug', `applyLayout called with outputUuid=${outputUuid}, layoutUuid=${layoutUuid}`)
	}

	let minGapMs = instance.config.queuedCommandDelay || DEFAULT_MIN_COMMAND_GAP_MS

	if (instance.config.useQueuedCommands == false) {
		minGapMs = 0
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

			// Deep clone to avoid mutating cache
			const next = JSON.parse(JSON.stringify(current.data))
			next.input = next.input || {}
			next.input.layouts = [layoutUuid]

			instance.log('info', `Applying layout "${layoutLabel}" to output "${outputLabel}"`)

			// Update the output's layout in the API
			await fetchJson(instance as TAGMCSInstance, true, `outputs/config/${outputUuid}`, 'PUT', next)
		},
		{ tag: 'applyLayout', minGapMs: minGapMs },
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

	let minGapMs = instance.config.queuedCommandDelay || DEFAULT_MIN_COMMAND_GAP_MS

	if (instance.config.useQueuedCommands == false) {
		minGapMs = 0
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

			instance.log(
				'info',
				`Setting audio channel "${channelLabel}" on output "${outputLabel}" (audio index ${audioIndex})`,
			)

			// Update the output's audio channel in the API
			await fetchJson(instance as TAGMCSInstance, true, `outputs/config/${outputUuid}`, 'PUT', next)
		},
		{ tag: 'setAudioChannel', minGapMs: minGapMs },
	)
}

async function getOutput(instance: TAGMCSInstance, uuid: string): Promise<any> {
	return fetchJson(instance, false, `outputs/config/${uuid}`, 'GET')
}

async function getLayout(instance: TAGMCSInstance, uuid: string): Promise<any> {
	return fetchJson(instance, false, `layouts/config/${uuid}`, 'GET')
}
