'use strict'
// NOTE: Also in popup.js
const settings = {
	'locator': null,
	'outline': '4px solid orange',
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

let gCachedLocator = null
let gCachedOutline = null
let gValidLocator = true
let gValidOutline = true

let gHighlightCounter = 0
let gMutationCounter = 0
let gRunCounter = 0
let gMatchCounter = 0

let gScheduledRun = null
let gLastMutationTime = Date.now()  // due to query run on startup
let gLandmarks = null
let gState = null

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
	wrapper.setAttribute('aria-label', ++gHighlightCounter)
	wrapper.setAttribute(LANDMARK_MARKER_ATTR, '')
	return wrapper
}

function removeHighlightsExceptFor(matches = new Set()) {
	// The landmark should be the element's parent, but other code running on
	// the page could've moved things around, so we store references to both.
	for (const [element, { outline, landmark }] of gHighlighted.entries()) {
		if (matches.has(element)) continue

		if (document.body.contains(element)) {
			element.style.outline = outline ?? ''
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

		const outline = element.style.outline
		if (gValidOutline) element.style.outline = gCachedOutline

		const landmark = gLandmarks ? makeWrappingLandmark() : null
		if (gLandmarks) {
			element.parentElement.insertBefore(landmark, element)
			landmark.appendChild(element)
		}

		gHighlighted.set(element, { outline, landmark })
	}
}

function locateAndhighlight(incrementRunCounter, removeAllHighlights) {
	gValidLocator = true
	gMatchCounter = 0
	const foundElements = new Set()

	if (gCachedLocator) {
		let nodeList = null

		if (gCachedLocator.startsWith('/')) {
			nodeList = evaluatePathAndSetValidity()
		} else {
			try {
				nodeList = document.body.querySelectorAll(gCachedLocator)
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
		if (gCachedLocator && gValidLocator) {
			observeDocument()
		} else {
			state(states.notObserving)
		}
	}

	sendInfo(true, false)
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
			gCachedLocator, document, null, XPathResult.ANY_TYPE, null)
	} catch {
		gValidLocator = false
	} finally {
		if (result !== null) {  // TODO: check docs for why this check needed
			// eslint-disable-next-line default-case
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
			}
		}
	}

	return nodeList
}

function checkOutlineValidity() {
	const test = document.createElement('DIV')
	test.style.outline = gCachedOutline
	gValidOutline = test.style.outline !== ''
	test.remove()
	chrome.runtime.sendMessage(
		{ name: 'validity', of: 'outline', data: gValidOutline })
}

function sendInfo(includeLocatorValidity, includeOutlineValidity) {
	chrome.runtime.sendMessage({ name: 'mutations', data: gMutationCounter })
	chrome.runtime.sendMessage({ name: 'runs', data: gRunCounter })
	chrome.runtime.sendMessage({ name: 'matches', data: gMatchCounter })
	chrome.runtime.sendMessage({ name: 'state', data: gState })
	if (includeLocatorValidity) {
		chrome.runtime.sendMessage(
			{ name: 'validity', of: 'locator', data: gValidLocator })
	}
	if (includeOutlineValidity) {
		chrome.runtime.sendMessage(
			{ name: 'validity', of: 'outline', data: gValidOutline })
	}
}

// Event handlers

// TODO: Use else-ifs?
chrome.storage.onChanged.addListener((changes) => {
	if (!document.hidden) {
		if ('locator' in changes) {
			gCachedLocator = changes.locator.newValue
			locateAndhighlight(true, false)
		}
		if ('outline' in changes) {
			gCachedOutline = changes.outline.newValue
			stopObserving()
			checkOutlineValidity()
			if (gValidOutline) {
				for (const element of gHighlighted.keys()) {
					element.style.outline = gCachedOutline
				}
			}
			if (gState !== states.manual && gCachedLocator) observeDocument()
		}
		if ('monitor' in changes) {
			if (changes.monitor.newValue === true) {
				state(states.observing)
				locateAndhighlight(false, false)  // will observeDocument()
			} else {
				stopObservingAndUnScheduleRun()
				state(states.manual)
			}
		}
		if ('landmarks' in changes) {
			gLandmarks = changes.landmarks.newValue
			locateAndhighlight(false, true)
		}
	}
})

chrome.runtime.onMessage.addListener(message => {
	if (message.name === 'get-info') {
		sendInfo(true, true)
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
		gCachedLocator = items.locator
		gCachedOutline = items.outline
		gLandmarks = items.landmarks
		state(items.monitor ? states.observing : states.manual)
		checkOutlineValidity()
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
	sendInfo(false, false)  // pop-up could be open with altered input values
	setTimeout(startUp, STARTUP_GRACE_TIME)
}
