'use strict'
// NOTE: Also in popup.js
const settings = {
	'selector': null,
	'outline': '4px solid yellow',
	'monitor-changes': true
}

const states = Object.freeze({
	'manual': 'Manual',
	'observing': 'Monitoring',
	'ignoring': 'Ignoring'
})

const LANDMARK_MARKER_ATTR = 'data-highlight-selector-landmark'
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
let gSentIgnoringMutationsMessage = false

let gState = null

// Mutation observation

const gObserver = new MutationObserver(() => {
	chrome.runtime.sendMessage({ name: 'mutations', data: ++gMutationCounter })
	const now = Date.now()
	if (now > gLastMutationTime + MUTATION_IGNORE_TIME) {
		runDueToMutation()
		gLastMutationTime = now
	} else {
		if (gScheduledRun) clearTimeout(gScheduledRun)
		gScheduledRun = setTimeout(runDueToMutation, MUTATION_IGNORE_TIME, now)
		if (!gSentIgnoringMutationsMessage) {
			gState = states.ignoring
			chrome.runtime.sendMessage({ name: 'state', data: gState })
			gSentIgnoringMutationsMessage = true
		}
	}
})

function runDueToMutation(now) {
	selectAndhighlight()
	gScheduledRun = null
	gSentIgnoringMutationsMessage = false
	gLastMutationTime = now
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
	gSentIgnoringMutationsMessage = false
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

		if (document.body.contains(landmark)) {
			landmark.replaceWith(...landmark.childNodes)
		} else {
			landmark.remove()
		}

		gHighlighted.delete(element)
	}
}

function highlight(elements) {
	for (const element of elements) {
		if (gHighlighted.has(element)) continue

		const outline = element.style.outline
		if (gValidOutline) element.style.outline = gCachedOutline

		const landmark = makeWrappingLandmark()
		element.parentElement.insertBefore(landmark, element)
		landmark.appendChild(element)

		gHighlighted.set(element, { outline, landmark })
	}
}

function selectAndhighlight() {
	gValidSelector = true
	gMatchCounter = -1
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
			gRunCounter++
		}
	}

	if (!gCachedSelector || !gValidSelector || foundElements) {
		stopObserving()
		removeHighlightsExceptFor(foundElements)
	}

	if (gMatchCounter > 0) {
		highlight(foundElements)
		observeDocument()
	}

	sendInfo()
}

function checkOutlineValidity() {
	const test = document.createElement('DIV')
	test.style.outline = gCachedOutline
	gValidOutline = test.style.outline !== ''
	test.remove()
	chrome.runtime.sendMessage(
		{ name: 'validity', of: 'outline', data: gValidOutline })
}

function sendInfo(includeOutline = false) {
	chrome.runtime.sendMessage({ name: 'mutations', data: gMutationCounter })
	chrome.runtime.sendMessage({ name: 'runs', data: gRunCounter })
	chrome.runtime.sendMessage({ name: 'matches', data: gMatchCounter })
	chrome.runtime.sendMessage({ name: 'state', data: gState })
	chrome.runtime.sendMessage(
		{ name: 'validity', of: 'selector', data: gValidSelector })
	if (includeOutline) {
		chrome.runtime.sendMessage(
			{ name: 'validity', of: 'outline', data: gValidOutline })
	}
}

// Event handlers

chrome.storage.onChanged.addListener((changes) => {
	if (!document.hidden) {
		if ('selector' in changes) {
			gCachedSelector = changes.selector.newValue
			selectAndhighlight()
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
			if (gCachedSelector) observeDocument()
		}
		if ('monitor-changes' in changes) {
			if (changes['monitor-changes'].newValue === true) {
				gState = states.observing
				observeDocument()
			} else {
				stopObservingAndUnScheduleRun()
				gState = states.manual
				chrome.runtime.sendMessage({ name: 'state', data: gState })
			}
		}
	}
})

chrome.runtime.onMessage.addListener(message => {
	// The popup only sends messages to the active window tab
	if (message.name === 'get-info') sendInfo(true)
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
		gState = items['monitor-changes'] ? states.observing : states.manual
		checkOutlineValidity()
		selectAndhighlight()
	})
}

document.addEventListener('visibilitychange', reflectVisibility)

// Firefox auto-injects content scripts
if (!document.hidden) startUp()
