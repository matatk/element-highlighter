Element Highlighter
===================

**Browser extension that highlights elements that match a CSS selector or an XPath. Highlighting can be visual, or via landmark regions.**

This simple browser extension highlights all elements on the page that match a selector or XPath, using a CSS outline and/or box shadow of your choice, and an optional tinting overlay. It can also create a landmark region for each match, so that if you can't see the screen, prefer using the keyboard, or are otherwise using assistive technologies (such as a screen reader, or the [Landmarks extension](https://matatk.agrip.org.uk/landmarks/)), you can easily find the matching elements.

Installing the extension
------------------------

You must have Node.js installed to build the extension. [Download Node.js,](https://nodejs.org/en/download) and if necessary, check out this excellent [guide to installing it.](https://kinsta.com/blog/how-to-install-node-js/)

Second you need to either check out, or [download the code](https://github.com/matatk/element-highlighter/archive/refs/heads/main.zip) and extract the ZIP file.

Third you build the extension:
* npm install
* npm run build

You can then sideload it manually in various browsers—point your browser at the `extension/` directory.

On Chromium-based browsers you will need to refresh any pages that are open when you first install the extension (Chromium doesn't automatically load the extension's script into existing tabs).

Here are sideloading instructions for some popular browsers:

* **Firefox:** [Temporary installation in Firefox](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/)

* **Edge:** [Sideload an extension](https://docs.microsoft.com/en-us/microsoft-edge/extensions-chromium/getting-started/extension-sideloading)

* **Chrome:** [Load an unpacked extension](https://developer.chrome.com/docs/extensions/mv3/getstarted/#unpacked)

**Notes:**

* For Firefox, it was necessary to specify an ID for the extension. This makes other browsers complain about non-standard manifest keys, but it doesn't affect functionality.

* If you have [`web-ext`](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/) installed you can use that to start it. Running `npm run start:firefox` or `npm run start:chrome` will open a blank test profile in either browser, with the extension installed, for quick testing.

Using the extension
-------------------

Activate the toolbar icon, or press <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>H</kbd> (<kbd>Option</kbd>+<kbd>Shift</kbd>+<kbd>H</kbd> on Mac) to bring up the pop-up, where you can update your selector/XPath and tweak (and toggle) the outline, box shadow, and tinting overlay styles.

In the pop-up, you can also toggle whether the page is automatically monitored for changes, whether landmark regions are placed around each match, and how landmarks are added (details below).

The settings apply across all pages, are saved across browser restarts. A button is provided to reset everything to the defaults (it leaves your selector/XPath alone, though).

The browser toolbar button is badged with the number of matches found (if there are any—if there are no matches, the badge is removed).

Pressing <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>E</kbd> (<kbd>Option</kbd>+<kbd>Shift</kbd>+<kbd>E</kbd> on Mac) will toggle whether highlighting and monitoring are enabled. This allows you to quickly revert the page back to its normal state, without losing your selector/XPath value.

### Change monitoring

By default, whilst a query exists in the "Selector or XPath" input box, the page will be re-queried on any DOM change (this uses a [MutationObserver](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver) behind the scenes). However, if there are subsequent changes to the DOM within a two-second window, they will be ignored, and the page will be re-queried at the end of a further two-second window. This is intended to mitigate most performance concerns during active use. Some pages (often web apps or games) change a lot, though, so the option is provided to change monitoring off.

It is recommended to disable the extension, leave the selector/XPath box blank, or to disable change monitoring, when you're not using the extension, to avoid wasting CPU time and energy.

### Landmark regions

**Note:** Landmark regions are only discoverable via assistive technologies, such as screen readers or the [Landmarks extension](https://matatk.agrip.org.uk/landmarks/).

Landmark regions are labelled with a number corresponding to the element's order in the set of elements found, and they're given a region description of "Highlight", so they can be distinguished from other regions on the page.

There are three ways that the extension can add landmarks for matches:

* A matching element with no semantics of its own is turned into a landmark directly. This is applied to the following elements, if they don't have explicit `role` attributes: custom elements (i.e. elements with a hyphen in their names); `<div>`; `<span>`; and `<p>`.

* A matching element that already has semantics of its own (i.e. a heading, form control, existing landmark region, or other semantic element) is wrapped with an element that provides the landmark region for the highlight. This allows the original semantics of the matching elements to remain.

* A matching element that is already a landmark region will simply have its name prepended with "(Highlight _n_)". Given that it's already a landmark, it's already highlighted in that sense, and _not_ wrapping it reduces the chances that the page layout will be broken.

Because the wrapping method might affect the visual styling of the page, it is used only when necessary. However, there is an option provided to allow you to always use the wrapping option, if you prefer it.

Keyboard workflow tips
----------------------

* Pressing <kbd>Return</kbd>/<kbd>Enter</kbd> or simply moving focus away from an input box will run the selector/XPath, or update the visual highlighting styles, if the values have changed.

* In addition, if you're running in manual mode (where the page is not monitored for changes), pressing <kbd>Return</kbd>/<kbd>Enter</kbd> will re-run the selector/XPath, even if it hasn't changed.

* The pop-up stays open after you've entered/updated values, so you can keep refining your selector/XPath. Instead of pressing <kbd>Return</kbd>/<kbd>Enter</kbd> after inputting a new selector/XPath, or visual highlight style, you can just press <kbd>Escape</kbd> and the pop-up will close, and the new value will be used.

Limitations
-----------

It's possible that, depending on the page's styling, the use of landmark regions can alter the visual presentation of the page—though there are mitigations in place, as described above. Adding landmarks might interfere with the functionality of the page, though this is expected to be extremely rare.

Only elements below the `<body>` will be counted as matches, and highlighted (for either type of query).

An XPath can return more than just an element, or elements, but only XPaths that return elements are supported. If any non-element nodes _are_ matched, they are discounted.

If you unload (or reload, or update) the extension whilst matches are highlighted, you'll need to refresh those pages to restore their appearance, and correct extension behaviour.

The extension is forbidden from running on built-in browser pages (where the URL doesn't start with `https?://`), and the browsers' extension store pages. The pop-up doesn't reflect this.

Acknowledgements
----------------

[@TPGJRogers](https://github.com/TPGJRogers) for the idea of using landmarks to demarcate matches. We had talked about more amusing ideas, such as playing sounds when entering/leaving matching elements, but that would've required code running within the user's assistive technology.

MDN and StackOverflow for help, as ever.
