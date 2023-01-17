'use strict'
// NOTE: Also in popup.js
const settings = {
	'on': true,
	'locator': null,
	'drawOutline': true,
	'outline': '2px solid orange',
	'drawBoxShadow': true,
	'boxShadow': 'inset 0 0 0 2px orange',
	'drawTint': false,
	'color': 'orange',
	'opacity': '25%',
	'monitor': true,
	'landmarks': false,
	'landmarksAlwaysWrap': false
}


//
// Landmarks borrowed stuff
//

// List of landmarks to navigate
const regionTypes = Object.freeze([
	// Core ARIA
	'banner',
	'complementary',
	'contentinfo',
	'form',           // spec says should label
	'main',
	'navigation',
	'region',         // spec says must label
	'search',

	// Digital Publishing ARIA module
	'doc-acknowledgments',
	'doc-afterword',
	'doc-appendix',
	'doc-bibliography',
	'doc-chapter',
	'doc-conclusion',
	'doc-credits',
	'doc-endnotes',
	'doc-epilogue',
	'doc-errata',
	'doc-foreword',
	'doc-glossary',
	'doc-index',         // via navigation
	'doc-introduction',
	'doc-pagelist',      // via navigation
	'doc-part',
	'doc-preface',
	'doc-prologue',
	'doc-toc'            // via navigation
])

// Mapping of HTML5 elements to implicit roles
const implicitRoles = Object.freeze({
	ASIDE:   'complementary',
	FOOTER:  'contentinfo',    // depending on its ancestor elements
	FORM:    'form',
	HEADER:  'banner',         // depending on its ancestor elements
	MAIN:    'main',
	NAV:     'navigation',
	SECTION: 'region'
})

// Sectioning content elements
const sectioningContentElements = Object.freeze([
	'ARTICLE',
	'ASIDE',
	'NAV',
	'SECTION'
])

// Non-<body> sectioning root elements
const nonBodySectioningRootElements = Object.freeze([
	'BLOCKQUOTE',
	'DETAILS',
	'FIELDSET',
	'FIGURE',
	'TD'
])

// non-<body> sectioning elements and <main>
const nonBodySectioningElementsAndMain = Object.freeze(
	sectioningContentElements.concat(nonBodySectioningRootElements, 'MAIN')
)

function checkIfLandmark(element) {
	// TODO: include these checks here? (Technically they _are_ needed for the
	//       element to actually _be_ a landmark, but how/does this affect
	//       people using AT to explore the page?
	if (isVisuallyHidden(element) || isSemantiallyHidden(element)) return false

	// Elements with explicitly-set rolees
	const rawRoleValue = element.getAttribute('role')
	const explicitRole = rawRoleValue
		? getValidExplicitRole(rawRoleValue)
		: null
	const hasExplicitRole = explicitRole !== null

	// Support HTML5 elements' native roles
	const role = explicitRole ?? getRoleFromTagNameAndContainment(element)

	// TODO: Could make this more efficient if ignoring the label content.
	// The element may or may not have a label
	const label = getARIAProvidedLabel(element)

	// Add the element if it should be considered a landmark
	if (role && isLandmark(role, hasExplicitRole, label)) {
		return true
	}

	return false
}

// This can only check an element's direct styles. We just stop recursing
// into elements that are hidden. That's why the heuristics don't call this
// function (they don't check all of a guessed landmark's parent elements).
function isVisuallyHidden(element) {
	if (element.hasAttribute('hidden')) return true

	const style = window.getComputedStyle(element)
	if (style.visibility === 'hidden' || style.display === 'none') {
		return true
	}

	return false
}

function isSemantiallyHidden(element) {
	if (element.getAttribute('aria-hidden') === 'true'
		|| element.hasAttribute('inert')) {
		return true
	}
	return false
}

function getRoleFromTagNameAndContainment(element) {
	const name = element.tagName
	let role = null

	if (name) {
		// eslint-disable-next-line no-prototype-builtins
		if (implicitRoles.hasOwnProperty(name)) {
			role = implicitRoles[name]
		}

		// <header> and <footer> elements have some containment-
		// related constraints on whether they're counted as landmarks
		if (name === 'HEADER' || name === 'FOOTER') {
			if (!isChildOfTopLevelSection(element)) {
				role = null
			}
		}
	}

	return role
}

function isChildOfTopLevelSection(element) {
	let ancestor = element.parentNode

	while (ancestor !== null) {
		if (nonBodySectioningElementsAndMain.includes(ancestor.tagName)) {
			return false
		}
		ancestor = ancestor.parentNode
	}

	return true
}

function getValidExplicitRole(value) {
	if (value) {
		if (value.indexOf(' ') >= 0) {
			const roles = value.split(' ')
			for (const role of roles) {
				if (regionTypes.includes(role)) {
					return role
				}
			}
		} else if (regionTypes.includes(value)) {
			return value
		}
	}
	return null
}

function getARIAProvidedLabel(element) {
	let label = null

	// TODO general whitespace test?
	// TODO if some IDs don't exist, this will include nulls - test?
	const idRefs = element.getAttribute('aria-labelledby')
	if (idRefs !== null && idRefs.length > 0) {
		const innerTexts = Array.from(idRefs.split(' '), idRef => {
			const labelElement = document.getElementById(idRef)
			return getInnerText(labelElement)
		})
		label = innerTexts.join(' ')
	}

	if (label === null) {
		label = element.getAttribute('aria-label')
	}

	return label
}

function getInnerText(element) {
	let text = null

	if (element) {
		text = element.innerText
		if (text === undefined) {
			text = element.textContent
		}
	}

	return text
}

function isLandmark(role, explicitRole, label) {
	// <section> and <form> are only landmarks when labelled.
	// <div role="form"> is always a landmark.
	if (role === 'region' || (role === 'form' && !explicitRole)) {
		return label !== null
	}
	return true  // already a valid role if we were called
}


//
// Content script stuff
//

const states = Object.freeze({
	startup: 'Paused on page load',
	observing: 'Monitoring',
	notObserving: 'Not monitoring',
	ignoring: 'Ignoring changes',
	manual: 'Manual activation'
})

const markerTypes = Object.freeze({
	direct: 'direct',
	existing: 'existing',
	wrapper: 'wrapper'
})

const LANDMARK_MARKER = 'data-element-highlighter-landmark'
const HIGHLIGHT_MARKER = 'data-element-highlighter-highlight'
const ORIG_ARIA_LABEL = 'data-original-aria-label'
const STARTUP_GRACE_TIME = 2e3
const MUTATION_IGNORE_TIME = 2e3
const gHighlights = new Map()  // element : { outline, boxShadow, tint, landmark }

const gCached = {}

// Info sent to pop-up
let gMatchCounter = 0
let gMutationCounter = 0
let gRunCounter = 0
let gState = null
let gValidLocator = true

let gHighlightLandmarkCounter = 0
let gScheduledRun = null
let gLastMutationTime = Date.now()  // due to query run on startup
let gPopupOpen = false

// Mutation observation

const gObserver = new MutationObserver(() => {
	gMutationCounter++
	if (!document.hidden && gPopupOpen) send('mutations', gMutationCounter)
	const now = Date.now()
	if (now > gLastMutationTime + MUTATION_IGNORE_TIME) {
		runDueToMutation(now)
		gLastMutationTime = now
	} else if (gScheduledRun === null) {
		gScheduledRun = setTimeout(
			runDueToMutation, MUTATION_IGNORE_TIME, now + MUTATION_IGNORE_TIME)
		state(states.ignoring)
	}
})

function runDueToMutation(currentTime) {
	locateAndhighlight()
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

function stopObservingAndUnScheduleRun() {
	gObserver.disconnect()
	gObserver.takeRecords()
	if (gScheduledRun) {
		clearTimeout(gScheduledRun)
		gScheduledRun = null
	}
}

// Managing highlights (outlines and landmarks)

function locateAndhighlight() {
	gValidLocator = true
	gMatchCounter = 0
	gHighlightLandmarkCounter = 0
	const foundElements = new Set()

	stopObservingAndUnScheduleRun()
	removeAllLandmarks()

	if (gCached.locator) {
		let nodeList = null

		if (gCached.locator.startsWith('/')) {
			nodeList = evaluatePathAndSetValidity()
		} else {
			try {
				nodeList = document.body.querySelectorAll(gCached.locator)
			} catch {
				gValidLocator = false
			}
		}

		if (gValidLocator) {
			for (const match of nodeList) {
				if (match.hasAttribute(LANDMARK_MARKER)
					|| match.hasAttribute(HIGHLIGHT_MARKER)) {
					console.error(match)
					throw Error('Element is flagged as a marker or highlight.')
				}
				foundElements.add(match)
			}
			gMatchCounter = foundElements.size
			gRunCounter++
		}
	}

	removeVisualHighlightsExceptFrom(foundElements)
	addVisualHighlights(foundElements)
	addAllLandmarks()

	if (gState !== states.manual) {
		if (gCached.locator && gValidLocator) {
			observeDocument()
		} else {
			state(states.notObserving)
		}
	}

	sendInfo()
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
			gCached.locator, document, null, XPathResult.ANY_TYPE, null)
	} catch {
		gValidLocator = false
	} finally {
		if (result !== null) {  // TODO: check docs for why this check needed
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
					break
				default:
			}
		}
	}

	return nodeList
}

function addVisualHighlights(elements) {
	for (const element of elements) {
		if (gHighlights.has(element)) continue

		// Save current property values first
		const outline = element.style.outline
		if (gCached.drawOutline && gCached.outline) {
			element.style.outline = gCached.outline
		}
		const boxShadow = element.style.boxShadow
		if (gCached.drawBoxShadow && gCached.boxShadow) {
			element.style.boxShadow = gCached.boxShadow
		}

		const tint = gCached.drawTint ? document.createElement('div') : null
		if (tint) {
			tint.style.position = 'absolute'

			const rect = element.getBoundingClientRect()
			tint.style.top = window.scrollY + rect.top + 'px'
			tint.style.left = window.scrollX + rect.left + 'px'
			tint.style.width = rect.width + 'px'
			tint.style.height = rect.height + 'px'

			tint.style.backgroundColor = gCached.color
			tint.style.opacity = gCached.opacity
			tint.style.pointerEvents = 'none'
			tint.style.zIndex = 9942
			tint.setAttribute(HIGHLIGHT_MARKER, '')
			document.body.appendChild(tint)
		}

		gHighlights.set(element, { outline, boxShadow, tint, landmark: null })
	}
}

function removeVisualHighlightsExceptFrom(matches = new Set()) {
	for (const [element, info] of gHighlights) {
		if (matches.has(element)) continue

		// NOTE: Not checking if the element is contained in the <body>,
		//       because removing it breaks some apps (e.g. maybe it's a dialog
		//       that can be shown/hidden).
		element.style.outline = info.outline ?? ''
		element.style.boxShadow = info.boxShadow ?? ''
		if (element.getAttribute('style') === '') {
			element.removeAttribute('style')
		}

		if (info.tint) info.tint.remove()

		gHighlights.delete(element)
	}
}

// NOTE: Must be called _after_ visual highlights are added.
function addAllLandmarks() {
	if (!gCached.landmarks) return

	for (const [element, info] of gHighlights) {
		if (gCached.landmarksAlwaysWrap
			|| (hasRole(element) && !checkIfLandmark(element))) {
			const wrapper = document.createElement('div')
			addLandmarkProperties(wrapper, true)
			element.parentElement.insertBefore(wrapper, element)
			wrapper.appendChild(element)
			info.landmark = wrapper
		} else {
			if (checkIfLandmark(element)) {
				addLandmarkPropertiesToExistingLandmark(element)
			} else {
				addLandmarkProperties(element, false)
			}
			info.landmark = element
		}
	}
}

// NOTE: Must be called _before_ visual highlights are removed.
function removeAllLandmarks() {
	// NOTE: There's no check for if the element is contained within the
	//       <body>, as this breaks some apps (which seem to retain
	//       non-attached elements to provide modals).
	for (const info of gHighlights.values()) {
		const landmark = info.landmark
		if (landmark) {
			const type = landmark.getAttribute(LANDMARK_MARKER)
			switch (type) {
				case markerTypes.wrapper:
					landmark.replaceWith(...landmark.childNodes)
					break
				case markerTypes.direct:
					removeLandmarkProperties(landmark)
					break
				case markerTypes.existing:
					removeLandmarkPropertiesFromExistingLandmark(landmark)
					break
				default:
					console.error(landmark)
					throw Error(`Landmark with invalid marker type: ${type}`)
			}
			info.landmark = null
		}
	}
}

function hasRole(element) {
	const names = [ 'div', 'span', 'p' ]
	if (!element.tagName.includes('-') &&
		!names.includes(element.tagName.toLowerCase())) return true
	if (element.hasAttribute('role')) return true
	return false
}

function addLandmarkProperties(element, isWrapper) {
	element.setAttribute('role', 'region')
	element.setAttribute('aria-roledescription', 'Highlight')
	element.setAttribute('aria-label', ++gHighlightLandmarkCounter)
	setMarker(element, isWrapper ? markerTypes.wrapper : markerTypes.direct)
}

function addLandmarkPropertiesToExistingLandmark(element) {
	gHighlightLandmarkCounter += 1
	const prelude = `(Highlight ${gHighlightLandmarkCounter})`
	const label = getARIAProvidedLabel(element)  // FIXME: double-call
	if (element.hasAttribute('aria-label')) {
		element.setAttribute(ORIG_ARIA_LABEL,
			element.getAttribute('aria-label'))
	}
	if (label) {
		element.setAttribute('aria-label', prelude + ' ' + label)
	} else {
		element.setAttribute('aria-label', prelude)
	}
	setMarker(element, 'existing')
}

function setMarker(element, type) {
	// eslint-disable-next-line no-prototype-builtins
	if (!markerTypes.hasOwnProperty(type)) {
		throw Error(`Cannot set invalid marker type: ${type}`)
	}
	element.setAttribute(LANDMARK_MARKER, markerTypes[type])
}

function removeLandmarkProperties(element) {
	element.removeAttribute('role')
	element.removeAttribute('aria-roledescription')
	element.removeAttribute('aria-label')
	element.removeAttribute(LANDMARK_MARKER)
}

function removeLandmarkPropertiesFromExistingLandmark(element) {
	if (element.hasAttribute(ORIG_ARIA_LABEL)) {
		element.setAttribute('aria-label',
			element.getAttribute(ORIG_ARIA_LABEL))
		element.removeAttribute(ORIG_ARIA_LABEL)
	} else {
		element.removeAttribute('aria-label')
	}
	element.removeAttribute(LANDMARK_MARKER)
}

function sendInfo() {
	send('matches', gMatchCounter)
	if (document.hidden || !gPopupOpen) return
	send('mutations', gMutationCounter)
	send('runs', gRunCounter)
	send('state', gState)
	send('locator-validity', gValidLocator)  // assume true on start-up
}

// Event handlers

function storageChangedHandlerStandby(changes) {
	if ('on' in changes) {
		gCached.on = changes.on.newValue
		if (!document.hidden) {
			setUpOrTearDownHandlers(true)
		}
	}
}

function storageChangedHandler(changes) {
	for (const setting in changes) {
		switch (setting) {
			case 'on':
				gCached[setting] = changes[setting].newValue
				if (changes.on.newValue === false) {
					setUpOrTearDownHandlers(false)
				}
				break
			case 'locator':
				gCached[setting] = changes[setting].newValue
				locateAndhighlight()
				break
			case 'drawOutline':
			case 'drawBoxShadow':
			case 'outline':
			case 'boxShadow':
				gCached[setting] = changes[setting].newValue
				stopObservingAndUnScheduleRun()
				for (const [element, info] of gHighlights) {
					if (!gCached.drawOutline || !gCached.outline) {
						element.style.outline = info.outline
					} else {
						element.style.outline = gCached.outline
					}
					if (!gCached.drawBoxShadow || !gCached.boxShadow) {
						element.style.boxShadow = info.boxShadow
					} else {
						element.style.boxShadow = gCached.boxShadow
					}
				}
				if (gState !== states.manual && gCached.locator) {
					observeDocument()
				}
				break
			case 'drawTint':
			case 'color':
			case 'opacity':
				gCached[setting] = changes[setting].newValue
				stopObservingAndUnScheduleRun()
				// NOTE: Have to remove all landmarks because FIXME
				if (gCached.landmarks) removeAllLandmarks()
				removeVisualHighlightsExceptFrom()
				locateAndhighlight()
				break
			case 'monitor':
				if (changes.monitor.newValue === true) {
					state(states.observing)
					locateAndhighlight()  // will observeDocument()
				} else {
					stopObservingAndUnScheduleRun()
					state(states.manual)
				}
				break
			case 'landmarks':
			case 'landmarksAlwaysWrap':
				if (gCached.landmarks) {
					stopObservingAndUnScheduleRun()
					removeAllLandmarks()
				}
				gCached[setting] = changes[setting].newValue
				if (gCached.landmarks) locateAndhighlight()
				break
			default:
				throw Error(`Unknown setting: ${setting}`)
		}
	}
}

function messageHandler(message) {
	switch (message.name) {
		case 'popup-open':
			gPopupOpen = message.data
			if (gPopupOpen) sendInfo()
			break
		case 'run':
			if (gState === states.manual) locateAndhighlight()
			break
	}
}

function reflectVisibility() {
	// In Firefox, the pop-up may be open when we switch between pages.
	//
	// NOTE: We have not been listening to messages (including the one about
	//       the popup's visibility) whilst invisible, so we ask the background
	//       script to update us.
	chrome.runtime.sendMessage({ name: 'popup-open' }, response => {
		if (chrome.runtime.lastError) {
			throw Error(chrome.runtime.lastError.message)
		}
		gPopupOpen = response.data
		setUpOrTearDownHandlers(!document.hidden && gCached.on)
	})
}

function setUpOrTearDownHandlers(enable) {
	if (enable) {
		chrome.storage.sync.get(settings, items => {
			Object.assign(gCached, items)
			state(items.monitor ? states.observing : states.manual)
			chrome.storage.onChanged.removeListener(storageChangedHandlerStandby)
			chrome.storage.onChanged.addListener(storageChangedHandler)
			chrome.runtime.onMessage.addListener(messageHandler)
			locateAndhighlight()
		})
	} else {
		chrome.runtime.onMessage.removeListener(storageChangedHandler)
		chrome.runtime.onMessage.removeListener(messageHandler)
		chrome.storage.onChanged.addListener(storageChangedHandlerStandby)
		stopObservingAndUnScheduleRun()
		removeAllLandmarks()
		removeVisualHighlightsExceptFrom()
		send('clear-badge')
	}
}

// Bootstrapping and helper functions

function state(newState) {
	gState = newState
	if (!document.hidden && gPopupOpen) send('state', newState)
}

// NOTE: Callers need to check document is visible, and whether popup is open
function send(name, data) {
	chrome.runtime.sendMessage({ name, data }, function() {
		if (chrome.runtime.lastError) {
			// NOTE: Was printing the message to console, but got loads of
			//       notices about the port closing before a response could be
			//       received, in Chrome. This doesn't seem to make sense, as
			//       the port is betwixt the poup and background script.
		}
	})
}

// NOTE: Only needed on Chromium (TODO: conditionally build)
chrome.runtime.connect({ name: 'unloaded' }).onDisconnect.addListener(() => {
	console.info('Content script disconnected due to extension unload/reload.')
	stopObservingAndUnScheduleRun()
	document.removeEventListener('visibilitychange', reflectVisibility)
	chrome.runtime.onMessage.removeListener(messageHandler)
})

// Actual start-up...
//
// This is all wrapped in checking the 'on' setting, because doing so here
// negates the need to unnecessarily get the setting each time page visibility
// changes.
chrome.storage.sync.get({ on: settings.on }, items => {
	gCached.on = items.on
	document.addEventListener('visibilitychange', reflectVisibility)

	// Firefox auto-injects content scripts
	if (!document.hidden) {
		state(states.startup)
		sendInfo()  // set badge text; update pop-up info if it's open
		setTimeout(() => {
			if (!document.hidden) {
				reflectVisibility()
			}
		}, STARTUP_GRACE_TIME)
	}
})
