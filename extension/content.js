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
let validSelector = true
let validOutline = true

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

		element.parentElement.replaceWith(element)

		highlighted.delete(element)
	}
}

function highlight(elements) {
	for (const element of elements) {
		if (highlighted.has(element)) continue

		originalInlineOutlines[element] = element.style.outline
		if (validOutline) element.style.outline = cachedOutline

		const wrapper = document.createElement('DIV')
		makeElementIntoLandmark(wrapper, true)
		element.parentElement.insertBefore(wrapper, element)
		wrapper.appendChild(element)

		highlighted.add(element)
	}
}

function selectAndhighlight() {
	validSelector = true
	if (cachedSelector) {
		let matches = null
		try {
			matches = new Set(document.querySelectorAll(cachedSelector))
		} catch {
			validSelector = false
			chrome.runtime.sendMessage(
				{ name: 'validity', of: 'selector', data: validSelector })
			chrome.runtime.sendMessage({ name: 'matches', data: -1 })
			return
		}
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
				for (const element of highlighted) {
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
	startUp()
}
