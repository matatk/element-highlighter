'use strict'
// NOTE: Also in popup.js
const settings = {
	'locator': null,
	'outline': '2px solid orange',
	'boxShadow': 'inset 0 0 0 2px orange',
	'monitor': true,
	'landmarks': false
}

const states = Object.freeze({
	startup: 'Paused on page load',
	observing: 'Monitoring',
	notObserving: 'Not monitoring',
	ignoring: 'Ignoring changes',
	manual: 'Manual activation'
})

const LANDMARK_MARKER_ATTR = 'data-element-highlighter-landmark'
const STARTUP_GRACE_TIME = 2e3
const MUTATION_IGNORE_TIME = 2e3
const gHighlighted = new Map()  // elmnt : { outline: str, landmark: elmnt }

const gCached = {
	outline: null,
	boxShadow: null,
	locator: null
}

let gValidLocator = true

let gLandmarks = null
let gState = null

let gMatchCounter = 0
let gHighlightLandmarkCounter = 0
let gMutationCounter = 0
let gRunCounter = 0

let gScheduledRun = null
let gLastMutationTime = Date.now()  // due to query run on startup

// Mutation observation

// TODO: Actually stop observing for two seconds?
const gObserver = new MutationObserver(() => {
	chrome.runtime.sendMessage({ name: 'mutations', data: ++gMutationCounter })
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

function runDueToMutation(currentTime) {
	locateAndhighlight(true, false)
	gScheduledRun = null
	gLastMutationTime = currentTime
}

function observeDocument() {
	gObserver.observe(document, {
		attributes: true,
		childList: true,
		subtree: true
	})
	state(states.observing)
}

function stopObserving() {
	gObserver.disconnect()
	gObserver.takeRecords()
}

function stopObservingAndUnScheduleRun() {
	stopObserving()
	if (gScheduledRun) {
		clearTimeout(gScheduledRun)
		gScheduledRun = null
	}
}

// Managing highlights (outlines and landmarks)

function makeWrappingLandmark() {
	const wrapper = document.createElement('DIV')
	wrapper.setAttribute('role', 'region')
	wrapper.setAttribute('aria-roledescription', 'Highlight')
	wrapper.setAttribute('aria-label', ++gHighlightLandmarkCounter)
	wrapper.setAttribute(LANDMARK_MARKER_ATTR, '')
	return wrapper
}

function removeHighlightsExceptFor(matches = new Set()) {
	// The landmark should be the element's parent, but other code running on
	// the page could've moved things around, so we store references to both.
	for (const [element, { outline, boxShadow, landmark }] of gHighlighted.entries()) {
		if (matches.has(element)) continue

		if (document.body.contains(element)) {
			element.style.outline = outline ?? ''
			element.style.boxShadow = boxShadow ?? ''
			if (element.getAttribute('style') === '') {
				element.removeAttribute('style')
			}
		} else {
			element.remove()
		}

		if (landmark) {
			if (document.body.contains(landmark)) {
				landmark.replaceWith(...landmark.childNodes)
			} else {
				landmark.remove()
			}
		}

		gHighlighted.delete(element)
	}
}

function highlight(elements) {
	for (const element of elements) {
		if (gHighlighted.has(element)) continue

		// Save current values first
		const outline = element.style.outline
		if (gCached.outline) element.style.outline = gCached.outline
		const boxShadow = element.style.boxShadow
		if (gCached.boxShadow) element.style.boxShadow = gCached.boxShadow

		const landmark = gLandmarks ? makeWrappingLandmark() : null
		if (gLandmarks) {
			element.parentElement.insertBefore(landmark, element)
			landmark.appendChild(element)
		}

		gHighlighted.set(element, { outline, boxShadow, landmark })
	}
}

function locateAndhighlight(incrementRunCounter, removeAllHighlights) {
	gValidLocator = true
	gMatchCounter = 0
	gHighlightLandmarkCounter = 0
	const foundElements = new Set()

	if (gCached.locator) {
		let nodeList = null

		if (gCached.locator.startsWith('/')) {
			nodeList = evaluatePathAndSetValidity()
		} else {
			try {
				nodeList = document.body.querySelectorAll(gCached.locator)
			} catch {
				gValidLocator = false
			}
		}

		if (gValidLocator) {
			for (const match of nodeList) {
				if (!match.hasAttribute(LANDMARK_MARKER_ATTR)) {
					foundElements.add(match)
				}
			}
			gMatchCounter = foundElements.size
			if (incrementRunCounter) gRunCounter++
		}
	}

	stopObserving()

	if (removeAllHighlights) {
		removeHighlightsExceptFor()  // when changing landmarks seting
	} else {
		removeHighlightsExceptFor(foundElements)
	}

	highlight(foundElements)

	if (gState !== states.manual) {
		if (gCached.locator && gValidLocator) {
			observeDocument()
		} else {
			state(states.notObserving)
		}
	}

	sendInfo(true)
}

// NOTE: Assumes we have already checked that we have an XPath as locator.
function evaluatePathAndSetValidity() {
	const nodeList = []
	let result = null

	function addNoBigNodes(node) {
		if (node === document ||
			node === document.documentElement ||
			node === document.body) {
			return
		}
		nodeList.push(node)
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
						addNoBigNodes(node)
					}
				}
					break
				case XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE:
				case XPathResult.ORDERED_NODE_SNAPSHOT_TYPE:
					for (let i = 0; i < result.snapshotLength; i++) {
						nodeList.push(result.snapshotItem(i))  // TODO: check
					}
					break
				case XPathResult.ANY_UNORDERED_NODE_TYPE:
				case XPathResult.FIRST_ORDERED_NODE_TYPE:
					addNoBigNodes(result.singleNodeValue)  // TODO: check
					break
				default:
			}
		}
	}

	return nodeList
}

function sendInfo(includeLocatorValidity) {
	chrome.runtime.sendMessage({ name: 'mutations', data: gMutationCounter })
	chrome.runtime.sendMessage({ name: 'runs', data: gRunCounter })
	chrome.runtime.sendMessage({ name: 'matches', data: gMatchCounter })
	chrome.runtime.sendMessage({ name: 'state', data: gState })
	if (includeLocatorValidity) {
		chrome.runtime.sendMessage(
			{ name: 'locator-validity', data: gValidLocator })
	}
}

// Event handlers

chrome.storage.onChanged.addListener((changes) => {
	if (document.hidden) return
	for (const setting in changes) {
		switch (setting) {
			case 'locator':
				gCached.locator = changes.locator.newValue
				locateAndhighlight(true, false)
				break
			case 'outline':
			case 'boxShadow':
				gCached[setting] = changes[setting].newValue
				stopObserving()
				for (const element of gHighlighted.keys()) {
					element.style[setting] = gCached[setting]
				}
				if (gState !== states.manual && gCached.locator) {
					observeDocument()
				}
				break
			case 'monitor':
				if (changes.monitor.newValue === true) {
					state(states.observing)
					locateAndhighlight(false, false)  // will observeDocument()
				} else {
					stopObservingAndUnScheduleRun()
					state(states.manual)
				}
				break
			case 'landmarks':
				gLandmarks = changes.landmarks.newValue
				locateAndhighlight(false, true)
				break
			default:
		}
	}
})

chrome.runtime.onMessage.addListener(message => {
	if (message.name === 'get-info') {
		sendInfo(true)
	} else if (message.name === 'run' && gState === states.manual) {
		locateAndhighlight(true, false)
	}
})

function reflectVisibility() {
	if (document.hidden) {
		stopObservingAndUnScheduleRun()
	} else {
		startUp()
	}
}

// Bootstrapping and state

function startUp() {
	chrome.storage.sync.get(settings, items => {
		gCached.locator = items.locator
		gCached.outline = items.outline
		gCached.boxShadow = items.boxShadow
		gLandmarks = items.landmarks
		state(items.monitor ? states.observing : states.manual)
		locateAndhighlight(true, false)
	})
}

function state(newState) {
	gState = newState
	chrome.runtime.sendMessage({ name: 'state', data: newState })
}

document.addEventListener('visibilitychange', reflectVisibility)

// Firefox auto-injects content scripts
if (!document.hidden) {
	state(states.startup)
	sendInfo(false)  // pop-up could be open with altered input values
	setTimeout(startUp, STARTUP_GRACE_TIME)
}
