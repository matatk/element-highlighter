// List of landmarks to navigate
const regionTypes: readonly string[] = [
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
]

// Mapping of HTML5 elements to implicit roles
const implicitRoles: Readonly<Record<string, string>> = {
	ASIDE:   'complementary',
	FOOTER:  'contentinfo',    // depending on its ancestor elements
	FORM:    'form',
	HEADER:  'banner',         // depending on its ancestor elements
	MAIN:    'main',
	NAV:     'navigation',
	SECTION: 'region'
}

// Sectioning content elements
const sectioningContentElements: readonly string[] = [
	'ARTICLE',
	'ASIDE',
	'NAV',
	'SECTION'
]

// Non-<body> sectioning root elements
const nonBodySectioningRootElements: readonly string[] = [
	'BLOCKQUOTE',
	'DETAILS',
	'FIELDSET',
	'FIGURE',
	'TD'
]

// non-<body> sectioning elements and <main>
const nonBodySectioningElementsAndMain: readonly string[] = [
	...sectioningContentElements, ...nonBodySectioningRootElements, 'MAIN'
]

export function checkIfLandmark(element: HTMLElement) {
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
function isVisuallyHidden(element: HTMLElement) {
	if (element.hasAttribute('hidden')) return true

	const style = window.getComputedStyle(element)
	if (style.visibility === 'hidden' || style.display === 'none') {
		return true
	}

	return false
}

function isSemantiallyHidden(element: HTMLElement) {
	if (element.getAttribute('aria-hidden') === 'true'
		|| element.hasAttribute('inert')) {
		return true
	}
	return false
}

function getRoleFromTagNameAndContainment(element: HTMLElement) {
	const name = element.tagName
	let role = null

	if (name) {
		if (name in implicitRoles) {
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

// TODO: check parentElement is OK here (was parentNode)
function isChildOfTopLevelSection(element: HTMLElement) {
	let ancestor = element.parentElement

	while (ancestor !== null) {
		if (nonBodySectioningElementsAndMain.includes(ancestor.tagName)) {
			return false
		}
		ancestor = ancestor.parentElement
	}

	return true
}

function getValidExplicitRole(value: string) {
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

export function getARIAProvidedLabel(element: HTMLElement) {
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

function getInnerText(element: HTMLElement | null) {
	let text = null

	if (element) {
		text = element.innerText
		if (text === undefined) {
			text = element.textContent
		}
	}

	return text
}

function isLandmark(role: string, hasExplicitRole: boolean, label: string | null) {
	// <section> and <form> are only landmarks when labelled.
	// <div role="form"> is always a landmark.
	if (role === 'region' || (role === 'form' && !hasExplicitRole)) {
		return label !== null
	}
	return true  // already a valid role if we were called
}
