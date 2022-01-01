'use strict'
// NOTE: Also in popup.js
const settings = {
	'selector': null,
	'outline': '4px solid yellow'
}

const LANDMARK_MARKER_ATTR = 'data-highlight-selector-landmark'
const highlighted = new Map()  // element : { outline[str], landmark[element] }
const mutationPause = 2e3

let cachedSelector = null
let cachedOutline = null
let validSelector = true
let validOutline = true

let highlightCounter = 0
let mutationCounter = 0
let runCounter = 0
let matchCounter = 0

let scheduled = null
let lastMutationTime = Date.now()  // due to query run on startup
let sentignoringMessage = false
let ignoring = false

// Mutation observation

const observer = new MutationObserver(() => {
	chrome.runtime.sendMessage({ name: 'mutations', data: ++mutationCounter })
	const now = Date.now()
	if (now > lastMutationTime + mutationPause) {
		runDueToMutation()
		lastMutationTime = now
	} else {
		if (scheduled) clearTimeout(scheduled)
		scheduled = setTimeout(runDueToMutation, mutationPause, now)
		if (!sentignoringMessage) {
			ignoring = true
			chrome.runtime.sendMessage({ name: 'ignoring', data: ignoring })
			sentignoringMessage = true
		}
	}
})

function runDueToMutation(now) {
	selectAndhighlight()
	scheduled = null
	sentignoringMessage = false
	lastMutationTime = now
}

function observeDocument() {
	ignoring = false
	chrome.runtime.sendMessage({ name: 'ignoring', data: ignoring })
	observer.observe(document, {
		attributes: true,
		childList: true,
		subtree: true
	})
}

// Managing highlights (outlines and landmarks)

function makeWrappingLandmark() {
	const wrapper = document.createElement('DIV')
	wrapper.setAttribute('role', 'region')
	wrapper.setAttribute('aria-roledescription', 'Highlight')
	wrapper.setAttribute('aria-label', ++highlightCounter)
	wrapper.setAttribute(LANDMARK_MARKER_ATTR, '')
	return wrapper
}

function removeHighlightsExceptFor(matches = new Set()) {
	// The landmark should be the element's parent, but other code running on
	// the page could've moved things around, so we store references to both.
	for (const [element, { outline, landmark }] of highlighted.entries()) {
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

		highlighted.delete(element)
	}
}

function highlight(elements) {
	for (const element of elements) {
		if (highlighted.has(element)) continue

		const outline = element.style.outline
		if (validOutline) element.style.outline = cachedOutline

		const landmark = makeWrappingLandmark()
		element.parentElement.insertBefore(landmark, element)
		landmark.appendChild(element)

		highlighted.set(element, { outline, landmark })
	}
}

function selectAndhighlight() {
	validSelector = true
	ignoring = true
	matchCounter = -1
	let foundElements  // eslint-disable-line init-declarations

	if (cachedSelector) {
		let nodeList = null
		try {
			nodeList = document.body.querySelectorAll(cachedSelector)
		} catch {
			validSelector = false
		}
		if (validSelector) {
			foundElements = new Set(Array.from(nodeList).filter(
				element => !element.hasAttribute(LANDMARK_MARKER_ATTR)))
			matchCounter = foundElements.size
		}
	}

	if (!cachedSelector || !validSelector || foundElements) {
		observer.disconnect()
		observer.takeRecords()
		removeHighlightsExceptFor(foundElements)
	}

	if (matchCounter > 0) {
		highlight(foundElements)
		observeDocument()
	}

	// TODO: DRY with get-info
	chrome.runtime.sendMessage(
		{ name: 'validity', of: 'selector', data: validSelector })
	chrome.runtime.sendMessage({ name: 'foundElements', data: matchCounter })
	chrome.runtime.sendMessage({ name: 'runs', data: ++runCounter })
	chrome.runtime.sendMessage({ name: 'ignoring', data: ignoring })
}

function checkOutlineValidity() {
	const test = document.createElement('DIV')
	test.style.outline = cachedOutline
	validOutline = test.style.outline !== ''
	test.remove()
	chrome.runtime.sendMessage(
		{ name: 'validity', of: 'outline', data: validOutline })
}

// Event handlers

chrome.storage.onChanged.addListener((changes) => {
	if (!document.hidden) {
		if ('selector' in changes) {
			cachedSelector = changes.selector.newValue
			selectAndhighlight()
		}
		if ('outline' in changes) {
			cachedOutline = changes.outline.newValue
			observer.disconnect()
			observer.takeRecords()
			checkOutlineValidity()
			if (validOutline) {
				for (const element of highlighted.keys()) {
					element.style.outline = cachedOutline
				}
			}
			if (cachedSelector) observeDocument()
		}
	}
})

chrome.runtime.onMessage.addListener(message => {
	if (message.name === 'get-info') {  // only sent to active window tab
		chrome.runtime.sendMessage({ name: 'mutations', data: mutationCounter })
		chrome.runtime.sendMessage({ name: 'runs', data: runCounter })
		chrome.runtime.sendMessage({ name: 'matches', data: matchCounter })
		chrome.runtime.sendMessage({ name: 'ignoring', data: ignoring })
		chrome.runtime.sendMessage(
			{ name: 'validity', of: 'selector', data: validSelector })
		chrome.runtime.sendMessage(
			{ name: 'validity', of: 'outline', data: validOutline })
	}
})

function reflectVisibility() {
	if (document.hidden) {
		observer.disconnect()
		observer.takeRecords()
		if (scheduled) {
			clearTimeout(scheduled)
			scheduled = null
		}
		sentignoringMessage = false
	} else {
		startUp()
	}
}

// Bootstrapping

function startUp() {
	chrome.storage.sync.get(settings, items => {
		cachedSelector = items.selector
		cachedOutline = items.outline
		checkOutlineValidity()
		selectAndhighlight()
	})
}

document.addEventListener('visibilitychange', reflectVisibility)

if (!document.hidden) {  // Firefox auto-injects content scripts
	startUp()
}
