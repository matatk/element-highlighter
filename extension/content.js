'use strict'
// also in content.js
const settings = {
	'selector': null,
	'outline': '4px solid yellow'
}
const LANDMARK = 'data-highlight-selector-landmark'
const highlighted = new Set([])
const originalInlineOutlines = {}
let highlightOutline = null
let highlightCounter = 0
let mutationCounter = 0

const observer = new MutationObserver(() => {
	chrome.runtime.sendMessage({ name: 'mutations', value: ++mutationCounter })
	reRunSelectAndHighlight()
})

function observeSpecifically() {
	observer.observe(document, {
		attributes: true,
		childList: true,
		subtree: true
	})
}

function makeElementIntoLandmark(element, asWrapper) {
	element.setAttribute('role', 'region')
	element.setAttribute('aria-roledescription', 'Highlight')
	element.setAttribute('aria-label', ++highlightCounter)
	element.setAttribute(LANDMARK, asWrapper ? 'wrapper' : '')
}

function highlight(elements) {
	for (const element of elements) {
		if (highlighted.has(element)) continue

		originalInlineOutlines[element] = element.style.outline
		element.style.outline = highlightOutline

		// Make it a landmark region
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

function updateOutlines() {
	observer.disconnect()
	observer.takeRecords()
	for (const element of highlighted) {
		element.style.outline = highlightOutline
	}
	observeSpecifically()
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

function selectAndHighlight(selector) {
	if (selector) {
		let matches = null
		try {
			matches = new Set(document.querySelectorAll(selector))
		} catch {
			console.error(`Probably an invalid selector: ${selector}`)
		}
		if (matches) {
			observer.disconnect()
			observer.takeRecords()
			removeHighlightsExceptFor(matches)
			highlight(matches)
		}
		observeSpecifically()
	} else {
		removeHighlightsExceptFor()
		observer.disconnect()
		observer.takeRecords()
	}
}

function reRunSelectAndHighlight() {
	chrome.storage.sync.get('selector', items => {
		selectAndHighlight(items.selector)
	})
}

// Event handlers

chrome.storage.onChanged.addListener((changes) => {
	if ('selector' in changes) {
		selectAndHighlight(changes.selector.newValue)
	}
	if ('outline' in changes) {
		highlightOutline = changes.outline.newValue
		updateOutlines()
	}
})

chrome.runtime.onMessage.addListener(message => {
	if (message.name === 'update-highlights') {
		reRunSelectAndHighlight()
	} else if (message.name === 'get-mutations') {
		chrome.runtime.sendMessage({
			name: 'mutations',
			value: mutationCounter
		})
	}
})

function reflectVisibility() {
	if (document.hidden) {
		observer.disconnect()
		observer.takeRecords()
	} else {
		observeSpecifically()
	}
}

// Bootstrapping

chrome.storage.sync.get(settings, items => {
	highlightOutline = items.outline
	selectAndHighlight(items.selector)
})

document.addEventListener('visibilitychange', reflectVisibility)
reflectVisibility()

// In case the pop-up is open
chrome.runtime.sendMessage({ name: 'mutations', value: mutationCounter })
