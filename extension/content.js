'use strict'
// NOTE: Also in popup.js
const settings = {
	'selector': null,
	'outline': '4px solid yellow'
}

const LANDMARK_MARKER_ATTR = 'data-highlight-selector-landmark'
// TODO: Merge these two?
const highlighted = new Map()  // maps elements to their landmark elements
const originalInlineOutlines = {}
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
let lastMutationTime = Date.now()  // due to scan on startup
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
	for (const [element, landmark] of highlighted.entries()) {
		if (matches.has(element)) continue

		// The landmark should be the element's parent, but other code could've
		// moved things around and this may no longer be the case.

		if (document.body.contains(element)) {
			element.style.outline = originalInlineOutlines[element] ?? ''
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

		delete originalInlineOutlines[element]
		highlighted.delete(element)
	}
}

function highlight(elements) {
	for (const element of elements) {
		if (highlighted.has(element)) continue

		originalInlineOutlines[element] = element.style.outline
		if (validOutline) element.style.outline = cachedOutline

		const wrapper = makeWrappingLandmark()
		element.parentElement.insertBefore(wrapper, element)
		wrapper.appendChild(element)

		highlighted.set(element, wrapper)
	}
}

function selectAndhighlight() {
	validSelector = true
	if (cachedSelector) {
		let nodeList = null
		let matches = null
		try {
			nodeList = document.body.querySelectorAll(cachedSelector)
		} catch {
			validSelector = false
			chrome.runtime.sendMessage(
				{ name: 'validity', of: 'selector', data: validSelector })
			chrome.runtime.sendMessage({ name: 'matches', data: -1 })
			return
		}
		matches = new Set(Array.from(nodeList).filter(
			element => !element.hasAttribute(LANDMARK_MARKER_ATTR)))
		matchCounter = matches.size
		if (matches) {
			observer.disconnect()
			observer.takeRecords()
			removeHighlightsExceptFor(matches)
			highlight(matches)
		}
		observeDocument()
	} else {
		matchCounter = -1
		removeHighlightsExceptFor()
		observer.disconnect()
		observer.takeRecords()
	}
	chrome.runtime.sendMessage(
		{ name: 'validity', of: 'selector', data: validSelector })
	chrome.runtime.sendMessage({ name: 'matches', data: matchCounter })
	chrome.runtime.sendMessage({ name: 'runs', data: ++runCounter })
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
		chrome.runtime.sendMessage({ name: 'ignoring', data: ignoring })
		chrome.runtime.sendMessage({ name: 'matches', data: matchCounter })
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
	chrome.runtime.sendMessage({ name: 'mutations', data: mutationCounter })
	chrome.runtime.sendMessage({ name: 'matches', data: matchCounter })
	chrome.runtime.sendMessage({ name: 'ignoring', data: ignoring })
	startUp()
}
