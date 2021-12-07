'use strict'
// NOTE: Also in popup.js
const settings = {
	'selector': null,
	'outline': '4px solid yellow'
}

const LANDMARK = 'data-highlight-selector-landmark'
const highlighted = new Set([])
const originalInlineOutlines = {}
let cachedSelector = null
let cachedOutline = null
let highlightCounter = 0
let mutationCounter = 0
let matchCounter = 0

// Mutation observation

const observer = new MutationObserver(() => {
	chrome.runtime.sendMessage({ name: 'mutations', data: ++mutationCounter })
	selectAndhighlight()
})

function observeDocument() {
	observer.observe(document, {
		attributes: true,
		childList: true,
		subtree: true
	})
}

// Managing highlights (outlines and landmarks)

function makeElementIntoLandmark(element, asWrapper) {
	element.setAttribute('role', 'region')
	element.setAttribute('aria-roledescription', 'Highlight')
	element.setAttribute('aria-label', ++highlightCounter)
	element.setAttribute(LANDMARK, asWrapper ? 'wrapper' : '')
}

function removeHighlightsExceptFor(matches = new Set()) {
	for (const element of highlighted) {
		if (matches.has(element)) continue

		element.style.outline = originalInlineOutlines[element] ?? ''
		if (element.getAttribute('style') === '') {
			element.removeAttribute('style')
		}
		delete originalInlineOutlines[element]

		// Remove the landmark region if present
		if (element.hasAttribute(LANDMARK)) {
			element.removeAttribute('role')
			element.removeAttribute('aria-roledescription')
			element.removeAttribute('aria-label')
			element.removeAttribute(LANDMARK)
		} else if (element.parentElement.getAttribute(LANDMARK) === 'wrapper') {
			element.parentElement.replaceWith(element)
		}

		highlighted.delete(element)
	}
}

function highlight(elements) {
	for (const element of elements) {
		if (highlighted.has(element)) continue

		originalInlineOutlines[element] = element.style.outline
		element.style.outline = cachedOutline

		// Wrap the element if needed, then make it a landmark region
		if (element.getAttribute('role') ||
			element.getAttribute('aria-labelledby') ||
			element.getAttribute('aria-label')) {
			const wrapper = document.createElement('DIV')
			makeElementIntoLandmark(wrapper, true)
			element.parentElement.insertBefore(wrapper, element)
			wrapper.appendChild(element)
		} else {
			makeElementIntoLandmark(element, false)
		}

		highlighted.add(element)
	}
}

function selectAndhighlight() {
	if (cachedSelector) {
		let matches = null
		try {
			matches = new Set(document.querySelectorAll(cachedSelector))
		} catch {
			console.error(`Probably an invalid selector: ${cachedSelector}`)
			return
		}
		matchCounter = matches.size
		if (matches) {
			observer.disconnect()
			observer.takeRecords()
			removeHighlightsExceptFor(matches)
			highlight(matches)
		}
		chrome.runtime.sendMessage({ name: 'matches', data: matchCounter })
		observeDocument()
	} else {
		removeHighlightsExceptFor()
		observer.disconnect()
		observer.takeRecords()
	}
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
			for (const element of highlighted) {
				element.style.outline = cachedOutline
			}
			if (cachedSelector) observeDocument()
		}
	}
})

chrome.runtime.onMessage.addListener(message => {
	if (message.name === 'get-counters') {  // only sent to active window tab
		chrome.runtime.sendMessage({ name: 'mutations', data: mutationCounter })
		chrome.runtime.sendMessage({ name: 'matches', data: matchCounter })
	}
})

function reflectVisibility() {
	if (document.hidden) {
		observer.disconnect()
		observer.takeRecords()
	} else {
		startUp()
	}
}

// Bootstrapping

function startUp() {
	chrome.storage.sync.get(settings, items => {
		cachedSelector = items.selector
		cachedOutline = items.outline
		selectAndhighlight()
	})
}

document.addEventListener('visibilitychange', reflectVisibility)

if (!document.hidden) {  // Firefox auto-injects content scripts
	chrome.runtime.sendMessage({ name: 'mutations', data: mutationCounter })
	chrome.runtime.sendMessage({ name: 'matches', data: matchCounter })
	startUp()
}
