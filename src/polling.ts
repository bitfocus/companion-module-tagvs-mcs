import { InstanceStatus } from '@companion-module/base'
import type { TAGMCSInstance } from './main.js'
import { fetchJson, BuildOutputChoices, BuildLayoutChoices, BuildChannelChoices } from './utils.js'

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

export async function getState(instance: TAGMCSInstance): Promise<void> {
	try {
		const outputs = await fetchJson(instance, false, 'outputs/config/')
		const layouts = await fetchJson(instance, false, 'layouts/config/')

		const channels = await fetchJson(instance, false, 'channels/config/')

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
			instance.log('debug', 'Choices changed; updating actions, variables, feedbacks')
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
		//if fetch failed, network error, etc
		instance.updateStatus(InstanceStatus.ConnectionFailure, 'Polling Failed')
		if (instance.config.verbose) {
			instance.log('debug', `Polling error: ${e}`)
		}

		console.log(e)
		StopPolling(instance)
	}
}
