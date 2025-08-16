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
}

export interface ChannelConfig {
	uuid: string
	label: string
}
