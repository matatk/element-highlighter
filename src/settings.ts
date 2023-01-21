export const defaults = {
	'on': true,
	'announce': false,
	'locator': '',
	'drawOutline': true,
	'outline': '2px solid orange',
	'drawBoxShadow': true,
	'boxShadow': 'inset 0 0 0 2px orange',
	'drawTint': false,
	'color': 'orange',
	'opacity': '25%',
	'monitor': true,
	'landmarks': false,
	'landmarksAlwaysWrap': false
} as const

type ToPrimitive<T> =
	T extends string ? string
	: T extends boolean ? boolean
	: never

type WideOpen<T> = {
	-readonly [K in keyof T]: ToPrimitive<T[K]>
}

export type Settings = WideOpen<typeof defaults>
export type Setting = keyof typeof defaults

// NOTE: These have to be checked at run-time, hence can't be in a type.
const cssSettings = [ 'outline', 'boxShadow', 'color', 'opacity' ] as const
export type CssSetting = typeof cssSettings[number]

export function isCssSetting(setting: string): setting is CssSetting {
	return (cssSettings as readonly string[]).includes(setting)
}
