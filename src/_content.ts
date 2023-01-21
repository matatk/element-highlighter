import { checkIfLandmark, getARIAProvidedLabel } from './landmarksStuff.js'
import { defaults } from './settings.js'

import type { DataMessageName, DataType, DefiniteDataMessage, Message, NonDataMessageName } from './messageTypes.js'
import type { Settings } from './settings.js'

type HighlightInfo = {
	outline: string,
	boxShadow: string,
	tint: HTMLElement | null,
	landmark: HTMLElement | null
}

const markers = [ 'direct', 'existing', 'wrapper' ] as const
type Marker = typeof markers[number]

function isMarker(marker: string | null): marker is Marker {
	if (!marker) return false
	return (markers as readonly string[]).includes(marker)
}

const statePrettyNames = {
	startup: 'Paused on page load',
	observing: 'Monitoring',
	notObserving: 'Not monitoring',
	ignoring: 'Ignoring changes',
	manual: 'Manual activation'
} as const

type State = keyof typeof statePrettyNames

// Adopted from @types/chrome
type StorageChanges = { [key: string]: chrome.storage.StorageChange }


const LANDMARK_MARKER = 'data-element-highlighter-landmark'
const HIGHLIGHT_MARKER = 'data-element-highlighter-highlight'
const ORIG_ARIA_LABEL = 'data-original-aria-label'
const STARTUP_GRACE_TIME = 2e3
const MUTATION_IGNORE_TIME = 2e3
const gHighlights = new Map<HTMLElement, HighlightInfo>()

const gCached: Settings = { ...defaults }

// Info sent to pop-up
let gMatchCounter = 0
let gMutationCounter = 0
let gRunCounter = 0
let gState: State
let gValidLocator = true

let gHighlightLandmarkCounter = 0
let gScheduledRun: ReturnType<typeof setTimeout> | null  // TODO: !node
let gLastMutationTime = Date.now()  // due to query run on startup
let gPopupOpen = false

// Mutation observation

const gObserver = new MutationObserver(() => {
	gMutationCounter++
	if (!document.hidden && gPopupOpen) send('mutations', gMutationCounter)
	const now = Date.now()
	if (now > gLastMutationTime + MUTATION_IGNORE_TIME) {
		runDueToMutation(now)
		gLastMutationTime = now
	} else if (gScheduledRun === null) {
		gScheduledRun = setTimeout(
			runDueToMutation, MUTATION_IGNORE_TIME, now + MUTATION_IGNORE_TIME)
		state('ignoring')
	}
})

function runDueToMutation(currentTime: number) {
	locateAndhighlight()
	gScheduledRun = null
	gLastMutationTime = currentTime
}

function observeDocument() {
	gObserver.observe(document, {
		attributes: true,
		childList: true,
		subtree: true
	})
	state('observing')
}

function stopObservingAndUnScheduleRun() {
	gObserver.disconnect()
	gObserver.takeRecords()
	if (gScheduledRun) {
		clearTimeout(gScheduledRun)
		gScheduledRun = null
	}
}

// Managing highlights (outlines and landmarks)

function locateAndhighlight() {
	gValidLocator = true
	gMatchCounter = 0
	gHighlightLandmarkCounter = 0
	const foundElements: Set<HTMLElement> = new Set()

	stopObservingAndUnScheduleRun()
	removeAllLandmarks()

	if (gCached.locator.length) {
		if (gCached.locator.startsWith('/')) {
			for (const match of evaluatePathAndSetValidity()) {
				foundElements.add(match)
			}
		} else {
			try {
				const matches = document.body.querySelectorAll(gCached.locator)
				for (const match of matches) {
					foundElements.add(match as HTMLElement)
				}
			} catch {
				gValidLocator = false
			}
		}

		if (gValidLocator) {
			// TODO: Remove
			for (const match of foundElements) {
				if (match.hasAttribute(LANDMARK_MARKER)
					|| match.hasAttribute(HIGHLIGHT_MARKER)) {
					console.error(match)
					throw Error('Element is flagged as a marker or highlight.')
				}
			}
			gMatchCounter = foundElements.size
			gRunCounter++
		}
	}

	removeVisualHighlightsExceptFrom(foundElements)
	addVisualHighlights(foundElements)
	addAllLandmarks()

	if (gState !== 'manual') {
		if (gCached.locator && gValidLocator) {
			observeDocument()
		} else {
			state('notObserving')
		}
	}

	sendInfo()
}

// NOTE: Assumes we have already checked that we have an XPath as locator.
function evaluatePathAndSetValidity(): HTMLElement[] {
	const nodeList: HTMLElement[] = []
	let result = null

	function addNoBigNodes(node: Document | HTMLElement) {
		if (node === document ||
			node === document.documentElement ||
			node === document.body) {
			return
		}
		nodeList.push(node as HTMLElement)
	}

	try {
		result = document.evaluate(
			gCached.locator, document, null, XPathResult.ANY_TYPE, null)
	} catch {
		gValidLocator = false
	} finally {
		if (result !== null) {  // TODO: check docs for why this check needed
			switch (result.resultType) {
				case XPathResult.UNORDERED_NODE_ITERATOR_TYPE:
				case XPathResult.ORDERED_NODE_ITERATOR_TYPE: {
					let node = null
					// eslint-disable-next-line no-cond-assign
					while (node = result.iterateNext()) {
						if (node.nodeType !== Node.ELEMENT_NODE) continue
						addNoBigNodes(node as HTMLElement)
					}
				}
					break
				case XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE:
				case XPathResult.ORDERED_NODE_SNAPSHOT_TYPE:
					for (let i = 0; i < result.snapshotLength; i++) {
						const node = result.snapshotItem(i)
						if (node && node.nodeType === Node.ELEMENT_NODE) {
							nodeList.push(node as HTMLElement)  // TODO: check
						}
					}
					break
				case XPathResult.ANY_UNORDERED_NODE_TYPE:
				case XPathResult.FIRST_ORDERED_NODE_TYPE: {
					const node = result.singleNodeValue
					if (node && node.nodeType === Node.ELEMENT_NODE) {
						addNoBigNodes(node as HTMLElement)  // TODO: check
					}
				}
					break
			}
		}
	}

	return nodeList
}

function addVisualHighlights(elements: Set<HTMLElement>) {
	for (const element of elements) {
		if (gHighlights.has(element)) continue

		// Save current property values first
		const outline = element.style.outline
		if (gCached.drawOutline && gCached.outline) {
			element.style.outline = gCached.outline
		}
		const boxShadow = element.style.boxShadow
		if (gCached.drawBoxShadow && gCached.boxShadow) {
			element.style.boxShadow = gCached.boxShadow
		}

		const tint = gCached.drawTint ? document.createElement('div') : null
		if (tint) {
			tint.style.position = 'absolute'

			const rect = element.getBoundingClientRect()
			tint.style.top = window.scrollY + rect.top + 'px'
			tint.style.left = window.scrollX + rect.left + 'px'
			tint.style.width = rect.width + 'px'
			tint.style.height = rect.height + 'px'

			tint.style.backgroundColor = gCached.color
			tint.style.opacity = gCached.opacity
			tint.style.pointerEvents = 'none'
			tint.style.zIndex = '9942'
			tint.setAttribute(HIGHLIGHT_MARKER, '')
			document.body.appendChild(tint)
		}

		gHighlights.set(element, { outline, boxShadow, tint, landmark: null })
	}
}

function removeVisualHighlightsExceptFrom(matches = new Set<HTMLElement>()) {
	for (const [ element, info ] of gHighlights) {
		if (matches.has(element)) continue

		// NOTE: Not checking if the element is contained in the <body>,
		//       because removing it breaks some apps (e.g. maybe it's a dialog
		//       that can be shown/hidden).
		element.style.outline = info.outline ?? ''
		element.style.boxShadow = info.boxShadow ?? ''
		if (element.getAttribute('style') === '') {
			element.removeAttribute('style')
		}

		if (info.tint) info.tint.remove()

		gHighlights.delete(element)
	}
}

// NOTE: Must be called _after_ visual highlights are added.
function addAllLandmarks() {
	if (!gCached.landmarks) return

	for (const [ element, info ] of gHighlights) {
		if (gCached.landmarksAlwaysWrap
			|| (hasRole(element) && !checkIfLandmark(element))) {
			const wrapper = document.createElement('div')
			addLandmarkProperties(wrapper, true)
			const parent = element.parentElement as HTMLElement  // checked
			parent.insertBefore(wrapper, element)
			wrapper.appendChild(element)
			info.landmark = wrapper
		} else {
			if (checkIfLandmark(element)) {
				addLandmarkPropertiesToExistingLandmark(element)
			} else {
				addLandmarkProperties(element, false)
			}
			info.landmark = element
		}
	}
}

// NOTE: Must be called _before_ visual highlights are removed.
function removeAllLandmarks() {
	// NOTE: There's no check for if the element is contained within the
	//       <body>, as this breaks some apps (which seem to retain
	//       non-attached elements to provide modals).
	for (const info of gHighlights.values()) {
		const landmark = info.landmark
		if (landmark) {
			const type = landmark.getAttribute(LANDMARK_MARKER)
			if (isMarker(type)) {
				switch (type) {
					case 'wrapper':
						landmark.replaceWith(...landmark.childNodes)
						break
					case 'direct':
						removeLandmarkProperties(landmark)
						break
					case 'existing':
						removeLandmarkPropertiesFromExistingLandmark(landmark)
				}
			} else {
				console.error(landmark)
				throw Error(`Landmark with invalid marker type: ${type}`)
			}
			info.landmark = null
		}
	}
}

function hasRole(element: HTMLElement) {
	const names = [ 'div', 'span', 'p' ]
	if (!element.tagName.includes('-') &&
		!names.includes(element.tagName.toLowerCase())) return true
	if (element.hasAttribute('role')) return true
	return false
}

function addLandmarkProperties(element: HTMLElement, isWrapper: boolean) {
	gHighlightLandmarkCounter++
	element.setAttribute('role', 'region')
	element.setAttribute('aria-roledescription', 'Highlight')
	element.setAttribute('aria-label', String(gHighlightLandmarkCounter))
	setMarker(element, isWrapper ? 'wrapper' : 'direct')
}

function addLandmarkPropertiesToExistingLandmark(element: HTMLElement) {
	gHighlightLandmarkCounter += 1
	const prelude = `(Highlight ${gHighlightLandmarkCounter})`
	const label = getARIAProvidedLabel(element)  // FIXME: double-call
	if (element.hasAttribute('aria-label')) {
		element.setAttribute(ORIG_ARIA_LABEL,
			element.getAttribute('aria-label') as string)
	}
	if (label) {
		element.setAttribute('aria-label', prelude + ' ' + label)
	} else {
		element.setAttribute('aria-label', prelude)
	}
	setMarker(element, 'existing')
}

function setMarker(element: HTMLElement, type: Marker) {
	element.setAttribute(LANDMARK_MARKER, type)
}

function removeLandmarkProperties(element: HTMLElement) {
	element.removeAttribute('role')
	element.removeAttribute('aria-roledescription')
	element.removeAttribute('aria-label')
	element.removeAttribute(LANDMARK_MARKER)
}

function removeLandmarkPropertiesFromExistingLandmark(element: HTMLElement) {
	if (element.hasAttribute(ORIG_ARIA_LABEL)) {
		element.setAttribute('aria-label',
			element.getAttribute(ORIG_ARIA_LABEL) as string)
		element.removeAttribute(ORIG_ARIA_LABEL)
	} else {
		element.removeAttribute('aria-label')
	}
	element.removeAttribute(LANDMARK_MARKER)
}

function sendInfo() {
	send('matches', gMatchCounter)
	if (document.hidden || !gPopupOpen) return
	send('locator-validity', gValidLocator)  // assume true on start-up
	send('mutations', gMutationCounter)
	send('runs', gRunCounter)
	send('state', statePrettyNames[gState])
}

// Event handlers

function storageChangedHandlerStandby(changes: StorageChanges) {
	if ('on' in changes) {
		gCached.on = changes.on.newValue
		if (!document.hidden) {
			setUpOrTearDownHandlers(true, true)
		}
	}
}

function set(setting: keyof Settings, change: chrome.storage.StorageChange) {
	if (typeof change.newValue === typeof gCached[setting]) {
		// @ts-ignore
		gCached[setting] = change.newValue
	}
}

function storageChangedHandler(changes: StorageChanges) {
	for (const [ changeName, change ] of Object.entries(changes)) {
		switch (changeName) {
			case 'on':
				set(changeName, change)
				if (changes.on.newValue === false) {
					setUpOrTearDownHandlers(false, true)
				}
				break
			case 'announce':
				set(changeName, change)
				break
			case 'locator':
				set(changeName, change)
				locateAndhighlight()
				break
			case 'drawOutline':
			case 'drawBoxShadow':
			case 'outline':
			case 'boxShadow':
				set(changeName, change)
				stopObservingAndUnScheduleRun()
				for (const [ element, info ] of gHighlights) {
					if (!gCached.drawOutline || !gCached.outline) {
						element.style.outline = info.outline
					} else {
						element.style.outline = gCached.outline
					}
					if (!gCached.drawBoxShadow || !gCached.boxShadow) {
						element.style.boxShadow = info.boxShadow
					} else {
						element.style.boxShadow = gCached.boxShadow
					}
				}
				if (gState !== 'manual' && gCached.locator) {
					observeDocument()
				}
				break
			case 'drawTint':
			case 'color':
			case 'opacity':
				set(changeName, change)
				stopObservingAndUnScheduleRun()
				// NOTE: Have to remove all landmarks because FIXME
				if (gCached.landmarks) removeAllLandmarks()
				removeVisualHighlightsExceptFrom()
				locateAndhighlight()
				break
			case 'monitor':
				if (changes.monitor.newValue === true) {
					state('observing')
					locateAndhighlight()  // will observeDocument()
				} else {
					stopObservingAndUnScheduleRun()
					state('manual')
				}
				break
			case 'landmarks':
			case 'landmarksAlwaysWrap':
				if (gCached.landmarks) {
					stopObservingAndUnScheduleRun()
					removeAllLandmarks()
				}
				set(changeName, change)
				if (gCached.landmarks) locateAndhighlight()
				break
			default:
				throw Error(`Unknown setting: ${changeName}`)
		}
	}
}

function messageHandler(message: Message) {
	switch (message.name) {
		case 'popup-open':
			if (message.data) gPopupOpen = message.data
			if (gPopupOpen) sendInfo()
			break
		case 'run':
			if (gState === 'manual') locateAndhighlight()
			break
	}
}

function visibilityHandler() {
	// In Firefox, the pop-up may be open when we switch between pages.
	//
	// NOTE: We have not been listening to messages (including the one about
	//       the popup's visibility) whilst invisible, so we ask the background
	//       script to update us.
	sendAndProcess('popup-open', response => {
		if (chrome.runtime.lastError) {
			throw Error(chrome.runtime.lastError.message)
		}
		gPopupOpen = response.data
		setUpOrTearDownHandlers(!document.hidden && gCached.on, false)
	})
}

function setUpOrTearDownHandlers(enable: boolean, userTriggered: boolean) {
	if (enable) {
		chrome.storage.sync.get(defaults, items => {
			Object.assign(gCached, items)
			state(items.monitor ? 'observing' : 'manual')
			chrome.storage.onChanged.removeListener(storageChangedHandlerStandby)
			chrome.storage.onChanged.addListener(storageChangedHandler)
			chrome.runtime.onMessage.addListener(messageHandler)
			locateAndhighlight()
		})
	} else {
		chrome.runtime.onMessage.removeListener(storageChangedHandler)
		chrome.runtime.onMessage.removeListener(messageHandler)
		chrome.storage.onChanged.addListener(storageChangedHandlerStandby)
		stopObservingAndUnScheduleRun()
		removeAllLandmarks()
		removeVisualHighlightsExceptFrom()
		send('clear-badge')
	}

	if (!document.hidden && userTriggered && gCached.announce) {
		const phrase = 'Highlighter ' + (enable ? 'on' : 'off')
		speechSynthesis.speak(new SpeechSynthesisUtterance(phrase))
	}
}

// Bootstrapping and helper functions

function state(newState: State) {
	gState = newState
	if (!document.hidden && gPopupOpen) send('state', statePrettyNames[newState])
}

// NOTE: Callers need to check document is visible, and whether popup is open
function send<Name extends NonDataMessageName>(name: Name): void
function send<Name extends NonDataMessageName>(name: Name): void
function send<Name extends DataMessageName>(name: Name, data: DataType<Name>): void
function send<Name extends NonDataMessageName | DataMessageName>(name: Name, data?: DataType<Name>) {
	const message = data !== undefined ? { name, data } : { name }
	chrome.runtime.sendMessage(message, function() {
		if (chrome.runtime.lastError) {
			// NOTE: Was printing the message to console, but got loads of
			//       notices about the port closing before a response could be
			//       received, in Chrome. This doesn't seem to make sense, as
			//       the port is betwixt the poup and background script.
		}
	})
}

// NOTE: Callers need to check document is visible, and whether popup is open
function sendAndProcess<Name extends NonDataMessageName>(
	name: Name, callback: (response: DefiniteDataMessage<Name>) => void
): void {
	chrome.runtime.sendMessage({ name }, callback)
}

// NOTE: Only needed on Chromium (TODO: conditionally build)
chrome.runtime.connect({ name: 'unloaded' }).onDisconnect.addListener(() => {
	console.info('Content script disconnected due to extension unload/reload.')
	stopObservingAndUnScheduleRun()
	document.removeEventListener('visibilitychange', visibilityHandler)
	chrome.runtime.onMessage.removeListener(messageHandler)
})

// Actual start-up...
//
// This is all wrapped in checking the 'on' setting, because doing so here
// negates the need to unnecessarily get the setting each time page visibility
// changes.
chrome.storage.sync.get({ on: defaults.on, announce: defaults.announce }, items => {
	Object.assign(gCached, items)
	document.addEventListener('visibilitychange', visibilityHandler)

	// Firefox auto-injects content scripts
	if (!document.hidden) {
		state('startup')
		sendInfo()  // set badge text; update pop-up info if it's open
		setTimeout(() => {
			if (!document.hidden) {
				visibilityHandler()
			}
		}, STARTUP_GRACE_TIME)
	}
})
