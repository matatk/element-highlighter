'use strict'
// also in content.js
const settings = {
	'selector': null,
	'outline': '4px solid yellow'
}
const LANDMARK_FLAG = 'data-highlight-selector-landmark'
const highlighted = new Set([])
const originalInlineOutlines = {}
let highlightOutline = null
let counter = 0

function highlight(elements) {
	for (const element of elements) {
		if (!highlighted.has(element)) {
			originalInlineOutlines[element] = element.style.outline
			element.style.outline = highlightOutline
			highlighted.add(element)

			// Make it a landmark region
			if (element.getAttribute('role') ||
				element.getAttribute('aria-labelledby') ||
				element.getAttribute('aria-label')) {
				// TODO
			} else {
				element.setAttribute('role', 'region')
				element.setAttribute('aria-roledescription', 'Highlight')
				element.setAttribute('aria-label', ++counter)
				element.setAttribute(LANDMARK_FLAG, '')
			}
		}
	}
}

function updateOutlines() {
	for (const element of highlighted) {
		element.style.outline = highlightOutline
	}
}

function removeHighlightsExceptFor(matches = new Set()) {
	for (const element of highlighted) {
		if (!matches.has(element)) {
			element.style.outline = originalInlineOutlines[element] ?? ''
			if (element.getAttribute('style') === '') {
				element.removeAttribute('style')
			}
			delete originalInlineOutlines[element]
			highlighted.delete(element)

			// Remove the landmark region if present
			if (element.hasAttribute(LANDMARK_FLAG)) {
				element.removeAttribute('role')
				element.removeAttribute('aria-roledescription')
				element.removeAttribute('aria-label')
				element.removeAttribute(LANDMARK_FLAG)
			}
		}
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
			removeHighlightsExceptFor(matches)
			highlight(matches)
		}
	} else {
		removeHighlightsExceptFor()
	}
}

chrome.storage.onChanged.addListener((changes) => {
	if ('selector' in changes) {
		selectAndHighlight(changes.selector.newValue)
	}
	if ('outline' in changes) {
		highlightOutline = changes.outline.newValue
		updateOutlines()
	}
})

chrome.storage.sync.get(settings, items => {
	highlightOutline = items.outline
	selectAndHighlight(items.selector)
})
