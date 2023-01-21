/* eslint-disable no-mixed-spaces-and-tabs */
export type Message =
	// Commands and responses
	  { name: 'clear-badge' }
	| { name: 'popup-open', data?: boolean }
	| { name: 'run' }
	// Standard info
	| { name: 'locator-validity', data: boolean }
	| { name: 'matches', data: number }
	| { name: 'mutations', data: number }
	| { name: 'runs', data: number }
	| { name: 'state', data: string }

export type DataMessageName<M = Message> =
	M extends { name: string }
		? M extends { data?: unknown } ? M['name'] : never
		: never

export type NonDataMessageName<M = Message> =
	M extends { name: string }
		? M extends { data: unknown } ? never : M['name']
		: never

export type DefiniteDataMessage<Name extends Message['name'], M = Message> =
	M extends { name: Name, data?: unknown }
		? { name: Name, data: NonNullable<M['data']> } : never

export type DataType<Name extends Message['name'], M = Message> =
	M extends { name: Name, data?: unknown } ? M['data'] : never
