// File: src/types.ts
export interface OutputConfig {
	uuid: string
	label: string
	input: {
		layouts: string[]
		audio: Array<{
			index: number
			channel: string
			audio_index: number
		}>
	}
	muxing?: {
		audio: Array<{ pid: number }>
	}
}

export interface LayoutConfig {
	uuid: string
	label: string
	tiles?: Array<{
		index: number
		type: string
		channel?: string
		text?: string
	}>
}

export interface ChannelConfig {
	uuid: string
	label: string
}
