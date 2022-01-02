'use strict'
// NOTE: Also in popup.js
const settings = {
	'selector': null,
	'outline': '4px solid orange',
	'monitor-changes': true,
	'landmarks': false
}

const states = Object.freeze({
	startup: 'Paused on page load',
	observing: 'Monitoring',
	notObserving: 'Not monitoring',
	ignoring: 'Ignoring changes',
	manual: 'Manual activation'
})

const LANDMARK_MARKER_ATTR = 'data-highlight-selector-landmark'
const STARTUP_GRACE_TIME = 2e3
const MUTATION_IGNORE_TIME = 2e3
const gHighlighted = new Map()  // element : { outline[str], landmark[element] }

let gCachedSelector = null
let gCachedOutline = null
let gValidSelector = true
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

const gObserver = new MutationObserver(() => {
	chrome.runtime.sendMessage({ name: 'mutations', data: ++gMutationCounter })
	const now = Date.now()
	if (now > gLastMutationTime + MUTATION_IGNORE_TIME) {
		runDueToMutation(now)
		gLastMutationTime = now
	} else if (gScheduledRun === null) {
		gScheduledRun = setTimeout(
			runDueToMutation, MUTATION_IGNORE_TIME, now + MUTATION_IGNORE_TIME)
		gState = states.ignoring
		chrome.runtime.sendMessage({ name: 'state', data: gState })
	}
})

function runDueToMutation(currentTime) {
	selectAndhighlight(true)
	gScheduledRun = null
	gLastMutationTime = currentTime
}

function observeDocument() {
	if (gState === states.manual) return
	gObserver.observe(document, {
		attributes: true,
		childList: true,
		subtree: true
	})
	gState = states.observing
	chrome.runtime.sendMessage({ name: 'state', data: gState })
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

function selectAndhighlight(incrementRunCounter, removeAllHighlights = false) {
	gValidSelector = true
	gMatchCounter = 0
	if (gState !== states.manual) gState = states.notObserving
	let foundElements  // eslint-disable-line init-declarations

	if (gCachedSelector) {
		let nodeList = null
		try {
			nodeList = document.body.querySelectorAll(gCachedSelector)
		} catch {
			gValidSelector = false
		}
		if (gValidSelector) {
			foundElements = new Set(Array.from(nodeList).filter(
				element => !element.hasAttribute(LANDMARK_MARKER_ATTR)))
			gMatchCounter = foundElements.size
			if (incrementRunCounter) gRunCounter++
		}
	}

	if (!gCachedSelector || !gValidSelector || foundElements) {
		stopObserving()
		if (removeAllHighlights) {
			removeHighlightsExceptFor()  // when changing landmarks seting
		} else {
			removeHighlightsExceptFor(foundElements)
		}
	}

	if (gMatchCounter > 0) {
		highlight(foundElements)
		if (gState !== states.manual) observeDocument()
	}

	sendInfo(true, false)
}

function checkOutlineValidity() {
	const test = document.createElement('DIV')
	test.style.outline = gCachedOutline
	gValidOutline = test.style.outline !== ''
	test.remove()
	chrome.runtime.sendMessage(
		{ name: 'validity', of: 'outline', data: gValidOutline })
}

function sendInfo(includeSelectorValidity, includeOutlineValidity) {
	chrome.runtime.sendMessage({ name: 'mutations', data: gMutationCounter })
	chrome.runtime.sendMessage({ name: 'runs', data: gRunCounter })
	chrome.runtime.sendMessage({ name: 'matches', data: gMatchCounter })
	chrome.runtime.sendMessage({ name: 'state', data: gState })
	if (includeSelectorValidity) {
		chrome.runtime.sendMessage(
			{ name: 'validity', of: 'selector', data: gValidSelector })
	}
	if (includeOutlineValidity) {
		chrome.runtime.sendMessage(
			{ name: 'validity', of: 'outline', data: gValidOutline })
	}
}

// Event handlers

chrome.storage.onChanged.addListener((changes) => {
	if (!document.hidden) {
		// TODO: use else-ifs?
		if ('selector' in changes) {
			gCachedSelector = changes.selector.newValue
			selectAndhighlight(false)
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
			if (gState !== states.manual && gCachedSelector) observeDocument()
		}
		if ('monitor-changes' in changes) {
			if (changes['monitor-changes'].newValue === true) {
				gState = states.observing
				selectAndhighlight(false)
			} else {
				stopObservingAndUnScheduleRun()
				gState = states.manual
				chrome.runtime.sendMessage({ name: 'state', data: gState })
			}
		}
		if ('landmarks' in changes) {
			gLandmarks = changes.landmarks.newValue
			selectAndhighlight(false, true)
		}
	}
})

chrome.runtime.onMessage.addListener(message => {
	if (message.name === 'get-info') {
		sendInfo(true, true)
	} else if (message.name === 'run' && gState === states.manual) {
		selectAndhighlight(true)
	}
})

function reflectVisibility() {
	if (document.hidden) {
		stopObservingAndUnScheduleRun()
	} else {
		startUp()
	}
}

// Bootstrapping

function startUp() {
	chrome.storage.sync.get(settings, items => {
		gCachedSelector = items.selector
		gCachedOutline = items.outline
		gLandmarks = items.landmarks
		gState = items['monitor-changes'] ? states.observing : states.manual
		checkOutlineValidity()
		selectAndhighlight(true)
	})
}

document.addEventListener('visibilitychange', reflectVisibility)

// Firefox auto-injects content scripts
if (!document.hidden) {
	gState = states.startup
	sendInfo(false, false)  // popup could be open with altered input values
	setTimeout(startUp, STARTUP_GRACE_TIME)
}
