import { InstanceStatus } from '@companion-module/base'
import type { TAGMCSInstance } from './main.js'
import { fetchJson, BuildOutputChoices, BuildLayoutChoices, BuildChannelChoices, BuildDeviceChoices } from './utils.js'

export function StartPolling(instance: TAGMCSInstance, interval = 5000): void {
	if (instance.pollInterval) {
		clearInterval(instance.pollInterval)
	}

	if (instance.config.verbose) {
		instance.log('debug', `Starting polling every ${interval} ms`)
	}

	instance.pollInterval = setInterval(() => {
		// Reading every layout's tiles can outlast a short interval; skip a poll rather than overlap them
		if (instance.pollInFlight) {
			return
		}
		instance.pollInFlight = true
		getState(instance)
			.catch((err) => {
				instance.log('error', `Polling failed: ${err}`)
				console.log(err)
				StopPolling(instance)
			})
			.finally(() => {
				instance.pollInFlight = false
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

export async function getState(instance: TAGMCSInstance): Promise<void> {
	try {
		const outputs = await fetchJson(instance, false, 'outputs/config/')
		const layouts = await fetchJson(instance, false, 'layouts/config/')

		const channels = await fetchJson(instance, false, 'channels/config/')

		const devices = await fetchJson(instance, false, 'devices/config/')

		instance.outputs = Array.isArray(outputs) ? outputs : outputs?.data || []
		instance.layouts = Array.isArray(layouts) ? layouts : layouts?.data || []
		instance.channels = Array.isArray(channels) ? channels : channels?.data || []
		instance.devices = Array.isArray(devices) ? devices : devices?.data || []

		if (instance.config.enableLayoutVariables) {
			await loadLayoutTiles(instance)
		}

		// turning layout variables on or off, or a layout gaining or losing tiles, changes which tile variables exist
		const tileVariables = JSON.stringify([
			instance.config.enableLayoutVariables,
			instance.layouts.map((l) => [l.uuid, l.tiles?.length ?? null]),
		])
		const tileVariablesChanged = tileVariables !== instance.tileVariables
		instance.tileVariables = tileVariables

		//compare these choices to existing ones, and only rebuild if changed
		const outputChoices = BuildOutputChoices(instance)
		const layoutChoices = BuildLayoutChoices(instance)
		const channelChoices = BuildChannelChoices(instance)
		const deviceChoices = BuildDeviceChoices(instance)

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
		if (JSON.stringify(deviceChoices) !== JSON.stringify(instance.deviceChoices)) {
			instance.deviceChoices = deviceChoices
			changed = true
		}

		if (changed) {
			instance.log('debug', 'Choices changed; updating actions, variables, feedbacks')
			instance.updateActions()
			instance.updateVariableDefinitions()
			instance.updateFeedbacks()
		} else if (tileVariablesChanged) {
			instance.log('debug', 'Tile variables changed; updating variables')
			instance.updateVariableDefinitions()
		}

		instance.setVariableValues({
			output_count: instance.outputs.length,
			layout_count: instance.layouts.length,
			channel_count: instance.channels.length,
			device_count: instance.devices.length,
		})

		instance.updateVariables()
		instance.checkFeedbacks()
	} catch (e) {
		//if fetch failed, network error, etc
		instance.updateStatus(InstanceStatus.ConnectionFailure, 'Polling Failed')
		if (instance.config.verbose) {
			instance.log('debug', `Polling error: ${e}`)
		}

		console.log(e)
		StopPolling(instance)
	}
}

/**
 * The layout list may leave out each layout's tiles. Read them from the layout itself when it does,
 * so the tile variables cover every layout, not only the ones on an output.
 */
async function loadLayoutTiles(instance: TAGMCSInstance): Promise<void> {
	for (const layout of instance.layouts) {
		if (Array.isArray(layout.tiles)) {
			continue
		}

		try {
			const detail = await fetchJson(instance, false, `layouts/config/${layout.uuid}`)
			const tiles = detail?.data?.tiles ?? detail?.tiles
			if (Array.isArray(tiles)) {
				layout.tiles = tiles
			}
		} catch (e) {
			// one layout failing should not stop the poll; its tiles stay unknown until the next one
			if (instance.config.verbose) {
				instance.log('debug', `Could not read tiles of layout ${layout.uuid}: ${e}`)
			}
		}
	}
}
