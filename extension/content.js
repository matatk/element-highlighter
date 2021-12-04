'use strict'
// also in content.js
const settings = {
	'selector': null,
	'outline': '4px solid yellow'
}
const highlighted = new Set([])
const originalInlineOutlines = {}
let highlightOutline = null

function highlight(elements) {
	for (const element of elements) {
		if (!highlighted.has(element)) {
			originalInlineOutlines[element] = element.style.outline
			element.style.outline = highlightOutline
			highlighted.add(element)
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
			delete originalInlineOutlines[element]
			highlighted.delete(element)
		}
	}
}

function selectAndHighlight(selector) {
	if (selector) {
		try {
			const matches = new Set(document.querySelectorAll(selector))
			if (matches) {
				removeHighlightsExceptFor(matches)
				highlight(matches)
			}
		} catch {
			console.error(`Probably an invalid selector: ${selector}`)
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
	selectAndHighlight(items.selector)
	highlightOutline = items.outline
})
