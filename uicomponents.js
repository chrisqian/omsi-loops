/** @satisfies {Record<string, (strings: TemplateStringsArray, ...exprs: any[]) => any>} */
const Rendered = {
    /**
     * Creates a {@link DocumentFragment} representing the given interpolated HTML string. If the initial backtick is followed
     * immediately by a newline, all initial whitespace is ignored (rather than being rendered as a text node). DOM properties
     * of HTML elements can be set by having an interpolation immediately follow a property name with an equals sign. Thus,
     * 
     * ```
     * Rendered.html`<input value="${5}">`
     * ```
     * 
     * will set the HTML attribute "value" to "5", but
     * 
     * ```
     * Rendered.html`<input value=${5}>`
     * ```
     * 
     * will set the DOM property `.value` to 5. This is especially useful for event handler properties.
     * 
     * If the string contains only a single element and you would like to have the {@link Element} rather than a {@link DocumentFragment}, just access `.firstElementChild`.
     * 
     * @param {TemplateStringsArray} strings
     * @param  {...any} exprs 
     * @returns 
     */
    html(strings, ...exprs) {
        const propAssignmentRegex = /(?<=\s+)(\w+)=$/;
        const rawStrings = [...strings.raw];
        if (strings.raw[0][0] === '\n' || strings.raw[0][0] === '\r') { // if this starts with an explicit linebreak, strip early whitespace
            rawStrings[0] = rawStrings[0].trimStart();
        }
        /** @type {{name: string, value: any}[]} */
        const propertiesToSet = [];
        for (const [i, string] of rawStrings.entries()) {
            const matches = propAssignmentRegex.exec(string);
            if (matches) {
                const propIdx = propertiesToSet.length;
                propertiesToSet.push({name: matches[1], value: exprs[i]});
                rawStrings[i] = string.replace(propAssignmentRegex, "");
                exprs[i] = `data-rendered-prop-to-set data-rendered-prop-idx-${propIdx}="${propIdx}"`;
            }
        }
        let htmlString = String.raw({raw: rawStrings}, ...exprs);
        if (htmlString[0] === '\n' || htmlString[0] === '\r') { // if this starts with a linebreak, strip early whitespace
            htmlString = htmlString.trimStart();
        }
        const template = document.createElement("template");
        template.innerHTML = htmlString;

        for (const elem of template.content.querySelectorAll("[data-rendered-prop-to-set]")) {
            elem.removeAttribute("data-rendered-prop-to-set");
            for (const attr of Array.from(elem.attributes)) {
                if (attr.name.startsWith("data-rendered-prop-idx-")) {
                    const setProp = propertiesToSet[parseInt(attr.value)];
                    elem.removeAttributeNode(attr);
                    if (setProp) {
                        elem[setProp.name] = setProp.value;
                    }
                }
            }
        }
        
        return template.content;
    },
    css(strings, ...exprs) {
        const cssString = String.raw(strings, ...exprs);
        const stylesheet = new CSSStyleSheet();
        stylesheet.replaceSync(cssString);
        return stylesheet;
    },
}

class BaseComponent extends HTMLElement {
    static tagName = "";

    /** @returns {string[]} */
    static get observedAttributes() {
        return [];
    }

    /** @type {CSSStyleSheet[]} */
    static stylesheets = [];

    /** @type {DocumentFragment|false} */
    static template;

    static cloneTemplate() {
        // this weird construction means you can just set this.template in the makeTemplate function
        this.template ??= (this.makeTemplate(), this.template);
        if (this._makeTemplateCalledBy !== this) {
            throw new Error(`Subclass of BaseComponent (${this.name}) must call super.makeTemplate!()`);
        }
        return this.template ? /** @type {DocumentFragment} */(this.template.cloneNode(true)) : undefined;
    }

    static _makeTemplateCalledBy = null;
    static makeTemplate() {
        this._makeTemplateCalledBy = this;
        this.template = false;
        this.stylesheets = [];
    }

    /** @param {ShadowRootInit} [shadowRootInit] */
    constructor(shadowRootInit = {mode: "open"}) {
        super();
        const shadowContent = new.target.cloneTemplate();
        if (shadowContent) {
            const shadow = this.attachShadow(shadowRootInit);
            shadow.append(shadowContent);
            shadow.adoptedStyleSheets.push(...new.target.stylesheets);
        }
        // let elementClass = new.target;
        // while (elementClass) {
        //     if (elementClass.tagName) {
        //         this.classList.add(`-${elementClass.tagName}`);
        //     }
        //     elementClass = Object.getPrototypeOf(elementClass);
        // }
    }

    connectedCallback() {
    }

    /** @param {string} name @param {string} oldValue @param {string} newValue */
    attributeChangedCallback(name, oldValue, newValue) {
    }

    /** @param {ElementDefinitionOptions} [options]  */
    static defineElement(options) {
        customElements.define(this.tagName, this, options);
    }
}

/**
 * @template {Element} T
 * A WrappingElement is a custom element that wraps a native one and attempts to behave like it.
 * For now, this is a one-way operation, because this will probably only ever be used statically.
 */
class WrappingElement extends BaseComponent {
    /**
     * @param {string|Element} elementOrId 
     * @param {boolean} [throwIfMissing] 
     * @param {boolean} [warnIfMissing] 
     */
    static get(elementOrId, throwIfMissing=true, warnIfMissing=true) {
        return getElement(elementOrId, this, throwIfMissing, warnIfMissing);
    }

    /** @type {T} */
    #wrappedElement;
    get wrappedElement() {
        return this.#wrappedElement;
    }
    /** @protected */
    set wrappedElement(element) {
        if (this.#wrappedElement === element) return;
        if (element) {
            this.wrapElement(element);
        }
    }
    get [wrappedElementSymbol]() {
        return this.wrappedElement;
    }

    /** @readonly @type {string} */
    wraps;

    observer = new MutationObserver(this.mutationHandler.bind(this));;
    /** @type {Record<string, boolean>} */
    omitAttributes = {
        __proto__: null,
        "wraps": true,
        "class": true,
        "id": true,
    };

    /** @param {(MutationRecord & {target:Element})[]} mutations */
    mutationHandler(mutations) {
        for (const {type, target, attributeName, oldValue} of mutations) {
            if (type !== "attributes" || this.omitAttributes[attributeName]) continue;
            const reflectTo = target === this ? this.wrappedElement : this;
            if (target.hasAttribute(attributeName)) {
                const value = target.getAttribute(attributeName);
                if (!reflectTo.hasAttribute(attributeName) || value !== reflectTo.getAttribute(attributeName)) {
                    reflectTo.setAttribute(attributeName, value);
                }
                if (value !== oldValue && target === this) {
                    this.attributeChanged(attributeName, value);
                }
            } else {
                if (reflectTo.hasAttribute(attributeName)) {
                    reflectTo.removeAttribute(attributeName);
                }
                if (target === this) {
                    this.attributeRemoved(attributeName);
                }
            }
        }
    }

    /** @param {string} name @param {string} value */
    attributeChanged(name, value) {
    }

    /** @param {string} name */
    attributeRemoved(name) {
    }

    /** @protected @param {T} element */
    wrapElement(element) {
        if (this.#wrappedElement) {
            throw new Error("Attempted to rebind wrappedElement!");
        }
        this.#wrappedElement = element;
        const mirroredAttributes = Object.fromEntries(Array.from(element.attributes).map(a => [a.name, a.value]));
        Object.setPrototypeOf(mirroredAttributes, null);
        for (const attr of this.attributes) {
            if (this.omitAttributes[attr.name]) continue;
            if (attr.name in mirroredAttributes) {
                delete mirroredAttributes[attr.name];
                this.omitAttributes[attr.name] = true;
            } else {
                element.setAttribute(attr.name, attr.value);
            }
        }
        for (const [name, value] of Object.entries(mirroredAttributes)) {
            if (this.omitAttributes[name]) continue;
            this.setAttribute(name, value);
        }
        // @ts-ignore
        this.wraps = element.tagName.toLowerCase();
        this.setAttribute("wraps", this.wraps);
        
        this.observer.observe(this, {attributes: true});
        this.observer.observe(element, {attributes: true});
    }
}

/** @extends {WrappingElement<HTMLValueElement>} */
class ShrinkWrapElement extends WrappingElement {
    static tagName = "shrink-wrap";

    static get observedAttributes() {
        return ["value", "placeholder"];
    }

    static makeTemplate() {
        super.makeTemplate();
        this.template = Rendered.html`
            <div>
                <slot name="input" part="input"></slot>
                <slot name="label" part="label"></slot>
            </div>`;
        this.stylesheets.push(Rendered.css`
            :host {
                display: inline;
            }
            :host > div {
                display: inline grid;
                vertical-align: baseline;
                grid: "cell" max-content / max-content;
                align-items: first baseline;
            }
            slot {
                display: block;
                grid-area: cell;
            }
            :host(:focus-within) slot[name=label] {
                visibility: hidden;
            }
            slot[name=input] {
                position: relative;
                align-self: stretch;
            }
            slot[name=input]::slotted(*) {
                position: absolute;
                inset: 0;
                width: 100%;
                box-sizing: border-box;
                cursor: pointer;
            }
            slot[name=input]::slotted(select:focus) {
                appearance: none;
                position: static;
                width: auto;
            }
            :host(:not(:focus-within)) slot[name=input] {
                opacity: 0
            }`);
    }

    get input() {
        return this.wrappedElement;
    }

    /** @type {HTMLSlotElement} */
    inputSlot;

    /** @type {HTMLSlotElement} */
    labelSlot;

    /** @type {HTMLElement} */
    label;

    get value() {
        return this.input.value;
    }

    set value(v) {
        if (this.input.value !== v) {
            this.input.value = v ?? "";
        }
        if (v) {
            this.setAttribute("value", v);
            // this.input.setAttribute("value", v);
        } else {
            this.removeAttribute("value");
            // this.input.removeAttribute("value");
        }
    }

    /** @type {string} */
    oldValue;

    constructor() {
        super({
            mode: "open",
            delegatesFocus: true,
        });
        this.omitAttributes["slot"] = true;
        const shadow = this.shadowRoot;
        this.inputHandler = this.inputHandler.bind(this);
        this.slotchangeHandler = this.slotchangeHandler.bind(this);
        this.inputSlot = shadow.querySelector("slot[name=input]");
        this.labelSlot = shadow.querySelector("slot[name=label]");
        this.inputSlot.addEventListener("slotchange", this.slotchangeHandler);
        this.labelSlot.addEventListener("slotchange", this.slotchangeHandler);
        // focus does not bubble, so we have to pick it up in the capture phase
        this.addEventListener("focus", e => this.oldValue = this.value, {capture: true, passive: true});
        this.addEventListener("change", e => this.input instanceof HTMLSelectElement && this.input.blur());
        this.mousetrap = new Mousetrap(this);
        this.mousetrap.bind("escape", e => {this.value = this.oldValue ?? this.value; this.input?.blur();});
        this.mousetrap.bind("enter", e => this.input?.blur());
    }

    /** @param {string} value  */
    getLabel(value) {
        if (this.input instanceof HTMLSelectElement && this.input.selectedIndex >= 0) {
            return this.input.options[this.input.selectedIndex].label;
        } else if (this.input instanceof HTMLInputElement && value === "") {
            return this.input.placeholder;
        }
        return value || " "; // that's an nbsp
    }

    inputHandler() {
        if (!this.input) return;
        this.value = this.input.value ?? "";
    }

    /** @param {Event & {target: HTMLSlotElement}} event  */
    slotchangeHandler({target}) {
        if (target === this.inputSlot) {
            this.#adoptInput(valueElement(target.assignedElements()[0]));
        } else if (target === this.labelSlot) {
            this.label = htmlElement(target.assignedElements()[0]);
        }
        if (this.wrappedElement && this.label) {
            this.label.textContent = this.getLabel(this.getAttribute("value") ?? "");
        }
    }

    connectedCallback() {
        if (this.children.length === 1) {
            // simple usage, assign slot and create label
            this.firstElementChild.setAttribute("slot", "input");
            this.firstElementChild.classList.add("shrink-wrapped");
            const label = document.createElement("span");
            label.className = "shrink-wrapped label";
            label.slot = "label";
            this.append(label);
        }
    }

    /** @param {HTMLValueElement} element  */
    #adoptInput(element) {
        this.wrappedElement = element;
        this.inputSlot.addEventListener("input", this.inputHandler, {capture: true, passive: true});
        this.inputHandler();
    }

    /** @param {string} name @param {string} oldValue @param {string} newValue */
    attributeChangedCallback(name, oldValue, newValue) {
        if (name === "value" && this.label) {
            this.label.textContent = this.getLabel(newValue ?? "");
        }
    }

    static { this.defineElement(); }
}

class ReorderableList extends BaseComponent {
    static tagName = "reorderable-list";
    static get observedAttributes() {
        return ["disabled"];
    }

    static makeTemplate() {
        super.makeTemplate();
        this.template = Rendered.html`<slot></slot>`;
        this.stylesheets.push(Rendered.css`
            :host {
                /* Borrowed from Fx's rules for <ul> */
                display: block;
                list-style-type: disc;
                /* Omitting the margins because they're a hassle to deal with */
                /* margin-block-start: 1em;
                margin-block-end: 1em; */
                padding-inline-start: 40px;
                counter-reset: list-item;
            }
        `);
    }

    get items() {
        return this.itemRefs.flatMap(r => r.deref());
    }

    get accepts() { return this.getAttribute("accepts"); }
    set accepts(v) { this.setAttribute("accepts", v); }

    get acceptsList() { return this.accepts?.split(" ").flatMap(s => s || undefined) ?? []; }

    /** @type {WeakRef<ListItem>[]} */
    itemRefs = [];

    /** @type {WeakMap<ListItem, number>} */
    indexMap = new WeakMap();

    constructor() {
        super();
        this.shadowRoot.querySelector("slot").addEventListener("slotchange", this.slotchangeHandler.bind(this));
    }

    /** @param {ListItem} listItem  */
    acceptsItem(listItem) {
        return listItem.parentElement === this || this.acceptsList.includes(listItem.getAttribute("kind"));
    }

    /** @param {Event & {target: HTMLSlotElement}} event  */
    slotchangeHandler(event) {
        const {target} = event;
        this.rescanItems(target.assignedElements());
    }

    rescanItems(elements = this.shadowRoot.querySelector("slot").assignedElements()) {
        let index = 0;
        let changed = false;

        for (const element of elements) {
            if (element instanceof ListItem) {
                const curIndex = index++;
                const existingItem = this.itemRefs[curIndex]?.deref();
                if (existingItem !== element) {
                    changed = true;
                    this.#setIndex(curIndex, element, existingItem);
                }
            }
        }

        if (index !== this.itemRefs.length) {
            changed = true;
            for (const [i, item] of this.itemRefs.slice(index).entries()) {
                this.#setIndex(index + i, null, item?.deref());
            }
            this.itemRefs.length = index;
        }
    }

    /** @param {number} curIndex @param {ListItem} item @param {ListItem} existingItem */
    #setIndex(curIndex, item, existingItem) {
        if (item) {
            this.itemRefs[curIndex] = new WeakRef(item);
        } else {
            delete this.itemRefs[curIndex];
        }
        if (existingItem) {
            this.indexMap.delete(existingItem);
        }
        if (item) {
            this.indexMap.set(item, curIndex);
        }
    }

    /** @param {string} name @param {string} oldValue @param {string} newValue */
    attributeChangedCallback(name, oldValue, newValue) {
    }

    static { this.defineElement(); }
}

class ListItem extends BaseComponent {
    static tagName = "list-item";

    static makeTemplate() {
        super.makeTemplate();
        // want to avoid any extraneous whitespace before the default slot (Rendered.html removes initial space matching [\r\n]\s+)
        this.template = Rendered.html`
            <div id="root" part="root"
                ><div id="markers" part="markers"
                    ><div id="expander" part="expander"></div
                    ><div id="dragger" part="dragger"></div
                ></div
                ><div id="content" part="content"
                    ><div id="default" part="default"
                        ><label part="label"><input id="presence" type="checkbox" part="presence"></label
                        ><slot id="defaultSlot"></slot
                    ></div>
                    <slot name="details" part="details"></slot>
                </div>
            </div>`;

        this.stylesheets.push(Rendered.css`
            :host {
                position: relative;
                /* Borrowed from Fx's rules for <li> */
                display: list-item;
                text-align: match-parent;
            }
            :host([optional]:not([present])) {
                color: color-mix(in srgb, currentColor 50%, transparent);
            }
            #root, #content {
                display: contents;
            }
            #markers {
                display: inline-flex;
                overflow: visible;
                flex-direction: row-reverse;
            }
            :host([position=outside]) #markers {
                width: 0;
            }
            :host([position=indent]) #root {
                display: flex;
                flex-direction: row;
                align-items: first baseline;
            }
            :host([position=indent]) #content {
                display: block;
                flex: 1 1 0;
            }
            #dragger {
                display: inline;
                cursor: grab;
                touch-action: none;
            }
            #dragger::before {
                content: "⣿";
                position: relative;
                top: -0.1em; /* just scoot that up a little bit */
                color: color-mix(in srgb, currentColor 50%, transparent);
            }
            #expander {
                display: inline;
                cursor: pointer;
            }
            #expander::before {
                content: "▸";
            }
            :host([open]) #expander::before {
                content: "▾";
            }
            :host([optional]:not([present])) #expander::before {
                content: "●";
            }
            #default {
                display: inline;
            }

            :host([dragging]) #dragger {
                cursor: grabbing;
            }
            :host(:is([reorderable],[expandable])) {
                list-style-type: none;
            }
            :host(:not([reorderable])) #dragger,
            :host(:not([expandable])) #expander,
            :host(:not([open][expandable])) slot[name=details],
            :host(:not([optional])) #presence {
                display: none;
            }
        `);
    }

    static get observedAttributes() {
        return [...super.observedAttributes, "label", "optional", "present"];
    }

    get expandable() { return this.hasAttribute("expandable"); }
    set expandable(v) { this.toggleAttribute("expandable", v); }

    get reorderable() { return this.hasAttribute("reorderable"); }
    set reorderable(v) { this.toggleAttribute("reorderable", v); }

    get open() { return this.hasAttribute("open"); }
    set open(v) { this.toggleAttribute("open", v); }

    get outside() { return this.hasAttribute("outside"); }
    set outside(v) { this.toggleAttribute("outside", v); }

    get optional() { return this.hasAttribute("optional"); }
    set optional(v) { this.toggleAttribute("optional", v); }

    get present() { return this.hasAttribute("present"); }
    set present(v) { this.toggleAttribute("present", v); }

    get dragging() { return this.hasAttribute("dragging"); }
    set dragging(v) { this.toggleAttribute("dragging", v); }

    get label() { return this.getAttribute("label") ?? ""; }
    set label(v) { if (this.label !== v) this.setAttribute("label", v); }

    /** @type {HTMLLabelElement} */
    labelPart;
    /** @type {Text} */
    labelText;
    /** @type {HTMLInputElement} */
    presencePart;
    /** @type {HTMLElement} */
    draggerPart;
    /** @type {HTMLElement} */
    expanderPart;
    /** @type {HTMLElement} */
    defaultPart;
    /** @type {HTMLSlotElement} */
    defaultSlot;
    /** @type {HTMLSlotElement} */
    detailsSlot;

    /** @type {number} */
    dragPointer;
    /** @type {Element} */
    startParent;
    /** @type {ChildNode} */
    startNext;
    /** @type {ListItem} */
    lastOver;
    /** @type {InstanceType<Mousetrap>} */
    mousetrap;

    constructor() {
        super();
        this.labelPart = this.shadowRoot.querySelector("label");
        this.labelPart.append(this.labelText = document.createTextNode(""))
        this.presencePart = this.shadowRoot.querySelector("input#presence");
        this.draggerPart = this.shadowRoot.getElementById("dragger");
        this.expanderPart = this.shadowRoot.getElementById("expander");
        this.defaultPart = this.shadowRoot.getElementById("default");
        this.defaultSlot = this.shadowRoot.querySelector("slot#defaultSlot");
        this.detailsSlot = this.shadowRoot.querySelector("slot[name=details]");

        for (const prop of Object.getOwnPropertyNames(ListItem.prototype)) {
            if (prop.endsWith("Handler") && typeof this[prop] === "function") {
                this[prop] = this[prop].bind(this);
            }
        }

        this.expanderPart.addEventListener("click", this.toggleOpenStateHandler);
        this.defaultSlot.addEventListener("slotchange", this.slotchangeHandler);
        this.defaultPart.addEventListener("dblclick", this.toggleOpenStateHandler);
        this.presencePart.addEventListener("input", this.presenceInputHandler);
        this.draggerPart.addEventListener("pointerdown", this.dragStartHandler);
        this.draggerPart.addEventListener("pointerup", this.dragEndHandler);
        this.draggerPart.addEventListener("click", this.dragEndHandler);
        this.draggerPart.addEventListener("pointercancel", this.dragEndHandler);
    }

    /** @param {PointerEvent} event  */
    dragStartHandler(event) {
        if (this.dragging && event.button !== 0) this.endDrag(event, true);
        if (this.dragging || event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        this.dragPointer = event.pointerId;
        this.dragging = true;
        this.startParent = this.parentElement;
        this.startNext = this.nextSibling;
        this.draggerPart.setPointerCapture(this.dragPointer);
        this.draggerPart.onpointermove = this.dragMoveHandler;
        this.mousetrap ??= new Mousetrap();
        this.mousetrap.bind("escape", e => this.endDrag(e, true));
        document.documentElement.setAttribute("data-dragging-list-item", this.id || "");
        // don't trust pointercapture to get all our events for us. set temporary listeners on the window.
        window.addEventListener("pointerdown", this.dragStartHandler);
        window.addEventListener("pointermove", this.dragMoveHandler);
        window.addEventListener("pointerup", this.dragEndHandler);
        this.dispatchEvent(new PointerEvent("dragStarted", event));
    }

    /** @param {UIEvent} event  */
    endDrag(event = null, revert = false) {
        if (!this.dragging) return;
        event?.preventDefault();
        event?.stopPropagation();
        this.dragging = false;
        this.draggerPart.releasePointerCapture(this.dragPointer);
        this.draggerPart.onpointermove = null;
        this.mousetrap?.unbind("escape");
        window.removeEventListener("pointerdown", this.dragStartHandler);
        window.removeEventListener("pointermove", this.dragMoveHandler);
        window.removeEventListener("pointerup", this.dragEndHandler);
        document.documentElement.removeAttribute("data-dragging-list-item");
        if (revert) {
            this.startParent.insertBefore(this, this.startNext);
            this.dispatchEvent(new UIEvent("dragCanceled", event));
        } else {
            this.dispatchEvent(new UIEvent("dragCompleted", event));
        }
        if (event instanceof PointerEvent && event.type === "pointermove" && (event.buttons & 2 /* right button */) !== 0 /* is held */) {
            document.addEventListener("contextmenu", e => e.preventDefault(), {once: true});
        }
    }

    /** @param {PointerEvent} event  */
    dragMoveHandler(event) {
        if (this.dragging && event.buttons > 1) this.endDrag(event, true);
        if (!this.dragging || event.pointerId !== this.dragPointer || (event.buttons & 1) !== 1) return;
        event.preventDefault();
        event.stopPropagation();
        const elements = document.elementsFromPoint(event.clientX, event.clientY);
        for (const element of elements) {
            if (element instanceof ListItem) {
                if (element === this) {
                    this.lastOver = null;
                    break;
                }
                if (element === this.lastOver) break;
                const targetList = element.parentElement;
                // console.log("found ListItem:",{this:this,element,targetList});
                if (!(targetList instanceof ReorderableList)) break;
                this.lastOver = element;
                try {
                    if (targetList === this.parentElement && (this.compareDocumentPosition(element) & this.DOCUMENT_POSITION_FOLLOWING) !== 0) {
                        targetList.insertBefore(this, element.nextSibling);
                    } else if (targetList === this.parentElement || targetList.acceptsItem(this)) {
                        targetList.insertBefore(this, element);
                    }
                } catch { }
                break;
            } else if (element instanceof ReorderableList && element.childElementCount === 0) {
                // console.log("found empty ReorderableList:",{this:this,element});
                element.append(this);
                break;
            }
        }
        // We know we should be dragging, but sometimes (like after moving an element) pointer capture can get lost. Get it back.
        this.draggerPart.setPointerCapture(this.dragPointer);
    }

    /** @param {PointerEvent} event  */
    dragEndHandler(event) {
        if (!this.dragging || ("pointerId" in event && event.pointerId !== this.dragPointer) || event.button !== 0) return;
        if (event.type === "pointerup") {
            const hasCapture = this.draggerPart.hasPointerCapture(this.dragPointer);
            // there will be a click coming shortly but Fx isn't dispatching it correctly. capture it on window
            // in order to make sure the click doesn't dispatch to a different element.
            window.addEventListener("click", this.dragEndHandler, {once: true, capture: true});
            // but in case it doesn't come, fire it off ourself and remove the override
            requestAnimationFrame(() => {
                this.endDrag(null, false);
                window.removeEventListener("click", this.dragEndHandler, {capture: true});
            });
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        // anything other than a "click" cancels the drag
        this.endDrag(event, event.type !== "click");
    }

    /** @param {Event & {target: HTMLSlotElement}} event  */
    slotchangeHandler(event) {
        const nodes = event.target.assignedNodes();
        if (nodes[0] && nodes[0].nodeType === Node.TEXT_NODE) {
            nodes[0].nodeValue = nodes[0].nodeValue.trimStart();
        }
    }

    /** @param {Event} event  */
    toggleOpenStateHandler(event) {
        if (event.defaultPrevented || !this.expandable) return;
        let checkTarget = event.target;
        while (checkTarget instanceof Element && checkTarget !== this) {
            if (isValueElement(checkTarget)) {
                return;
            }
            checkTarget = checkTarget.parentElement;
        }
        this.open = !this.open;
        event.preventDefault();
    }

    presenceInputHandler() {
        this.present = this.presencePart.checked;
    }

    /** @param {string} name @param {string} oldValue @param {string} newValue */
    attributeChangedCallback(name, oldValue, newValue) {
        switch (name) {
            case "optional":
                newValue = this.label;
                /* fall through */
            case "label":
                this.labelText.nodeValue = `${this.optional ? " " : ""}${newValue ?? ""}${newValue ? " " : ""}`;
                break;
            case "present":
                this.presencePart.checked = typeof newValue === "string";
        }
    }

    static { this.defineElement(); }
}