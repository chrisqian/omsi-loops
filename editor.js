const baseValueTypes = {
    skillLevel: ["Skill Level"],
    buffLevel: ["Buff Level"],
    primaryValue: ["Primary value of action"],
    progressLevel: ["Progress Level"],
    goodItems: ["Total known-good items"],
    discoveredItems: ["Total discovered items"],
    checkedItems: ["Total checked items"],
    value: ["Calculated Value"],
    function: ["JS function"],
};
const numericAdjustmentTypes = {
    addition: ["Add"],
    subtraction: ["Subtract"],
    multiplier: ["Multiply by"],
    divisor: ["Divide by"],
    adjustment: ["Named adjustment"],
    skillBonus: ["Apply Skill Bonus", "using the standard multiplier for "],
    prestigeBonus: ["Apply Prestige Bonus"],
    surveyBonus: ["Apply Survey Bonus"],
    additiveBonus: ["Add bonuses before applying"],
    skillMod: ["Skill-based modifier", "When the level of the ", " skill is"],
    setValue: ["Set arbitrary value"],
    ceil: ["Round up"],
    floor: ["Round down"],
    round: ["Round to nearest"],
    clampMin: ["Clamp to minimum"],
    clampMax: ["Clamp to maximum"],
};
const conditionalRuleTypes = {
    if: ["If arbitrary value"],
    ifPrimaryValue: ["If action's primary value"],
    ifCurrentValue: ["If current evaluation"],
    ifResource: ["If resource"],
    ifHasResource: ["If player has resource"],
    ifStoryFlag: ["If story flag", "", " is set"],
    ifProgress: ["If current progress level", "of "],
    ifGoodItems: ["If total known-good items", "for action: "],
    ifDiscoveredItems: ["If total discovered items", "for action: "],
    ifCheckedItems: ["If total checked items", "for action: "],
};
const numericTestTypes = {
    min: "≥",
    minExclusive: ">",
    max: "≤",
    maxExclusive: "<",
    equals: "=",
    notEquals: "≠",
};

/**
 * @typedef {keyof typeof baseValueTypes} BaseValueType
 * @typedef {keyof typeof numericAdjustmentTypes} NumericAdjustmentType
 * @typedef {keyof typeof conditionalRuleTypes} ConditionalRuleType
 * @typedef {keyof typeof numericTestTypes} NumericTestType
 * @typedef {NumericAdjustmentType | ConditionalRuleType} EvaluationRuleType
 */

/** @returns {type is BaseValueType} */
function isBaseValueType(type) {
    return type in baseValueTypes;
}
/** @returns {type is ConditionalRuleType} */
function isConditionalRuleType(type) {
    return type in conditionalRuleTypes;
}
/** @returns {type is NumericAdjustmentType} */
function isNumericAdjustmentType(type) {
    return type in numericAdjustmentTypes;
}
/** @returns {type is NumericTestType} */
function isNumericTestType(type) {
    return type in numericTestTypes;
}
/** @returns {type is EvaluationRuleType} */
function isEvaluationRuleType(type) {
    return isConditionalRuleType(type) || isNumericAdjustmentType(type);
}

/** @satisfies {Record<BaseValueType, string[]>} */
const baseValueClasses = /** @type {const} */({
    progressLevel: ["varName", "progressVarName"],
    skillLevel: ["nameSelect", "skillName"],
    buffLevel: ["nameSelect", "buffName"],
    primaryValue: ["nameSelect", "actionName"],
    value: ["numericEvaluation"],
    function: ["nameSelect", "functionName"],
    checkedItems: ["varName", "limitedVarName"],
    discoveredItems: ["varName", "limitedVarName"],
    goodItems: ["varName", "limitedVarName"],
});

/** @satisfies {Record<EvaluationRuleType, string[]>} */
const ruleClasses = /** @type {const} */({
    addition: ["numericEvaluation"],
    subtraction: ["numericEvaluation"],
    multiplier: ["numericEvaluation"],
    divisor: ["numericEvaluation"],
    adjustment: ["nameSelect", "adjustmentName"],
    skillBonus: ["nameSelect", "skillName"],
    prestigeBonus: ["nameSelect", "prestigeBuffName"],
    surveyBonus: [],
    additiveBonus: [],
    skillMod: ["nameSelect", "skillName", "skillMod"],
    setValue: ["numericEvaluation"],
    ceil: [],
    floor: [],
    round: [],
    clampMin: ["numericEvaluation"],
    clampMax: ["numericEvaluation"],
    if: ["numericEvaluation", "numericCondition"],
    ifPrimaryValue: ["nameSelect", "actionName", "numericCondition"],
    ifCurrentValue: ["numericCondition"],
    ifResource: ["nameSelect", "numericCondition", "resourceName"],
    ifHasResource: ["nameSelect", "booleanCondition", "resourceName"],
    ifStoryFlag: ["nameSelect", "booleanCondition", "storyFlagName"],
    ifProgress: ["numericCondition", "varName", "progressVarName"],
    ifGoodItems: ["numericCondition", "varName", "limitedVarName"],
    ifDiscoveredItems: ["numericCondition", "varName", "limitedVarName"],
    ifCheckedItems: ["numericCondition", "varName", "limitedVarName"],
});

/**
 * @template {string} S
 * @typedef {S extends `${infer S1} ${infer S2}` ? S1 | Split<S2> : S extends '' ? never : S} Split
 */

/**
 * @typedef {Split<typeof baseValueClasses[BaseValueType][number]>} BaseValueClass
 * @typedef {Split<typeof ruleClasses[EvaluationRuleType][number]>} RuleClass
 */

class DataElement {
    static defaultIndent = 4;
    /** @type {string} */
    static defaultTemplate;
    /** @type {Readonly<Record<string, boolean>>} */
    static defaultFieldRequirements;

    static addDefaultFields(requiredFields = [], optionalFields = []) {
        const defaultFields = {...this.defaultFieldRequirements};
        for (const name of requiredFields) {
            defaultFields[name] = true;
        }
        for (const name of optionalFields) {
            defaultFields[name] = false;
        }
        this.defaultFieldRequirements = defaultFields;
    }

    /** @type {Element} */
    xmlElement;
    /** @type {string} */
    tagName;
    indentColumns = 0;
    /** @type {HTMLElement} */
    uiElement;
    /** @type {DataElement} */
    parent;
    /** @type {Record<string, boolean>} */
    fieldRequirements;
    /** @type {Record<string, string>} */
    stringFields = {__proto__: null};
    /** @type {Record<string, DataElement>} */
    namedChildren = {__proto__: null};

    isOptional = false;
    isPresent = true;

    uiSpawned = false;

    get rootActionDefinition() {
        return this instanceof ActionDefinition ? this : this.parent?.rootActionDefinition;
    }

    /** @param {DataElement} parent @param {Element|string} elementOrTagName @param {boolean} optional @param {boolean} [present] */
    constructor(parent, elementOrTagName, optional = false, present = undefined) {
        this.parent = parent;
        this.xmlElement = elementOrTagName instanceof Element ? elementOrTagName : null;
        this.tagName = elementOrTagName instanceof Element ? elementOrTagName.tagName : elementOrTagName;
        this.indentColumns = (this.parent?.indentColumns ?? -DataElement.defaultIndent) + DataElement.defaultIndent;
        this.isOptional = optional;
        this.isPresent = present ?? (optional ? !!this.xmlElement : true);
        if (this.constructor["defaultFieldRequirements"]) {
            this.fieldRequirements = {__proto__: null, ...this.constructor["defaultFieldRequirements"]};
        }
    }

    #initDone = false;
    init() {
        if (this.#initDone) throw new Error("Attempting to re-call init()");
        this.#initDone = true;
        if (this.xmlElement) {
            const previous = this.xmlElement.previousSibling;
            if (previous?.nodeType === Node.TEXT_NODE) {
                const leadingText = previous.nodeValue;
                if (leadingText.includes("\n")) {
                    const indentText = leadingText.slice(leadingText.lastIndexOf("\n") + 1);
                    this.indentColumns = indentText.length - indentText.trimStart().length;
                }
            }
            for (const [name, required] of Object.entries(this.fieldRequirements ?? {})) {
                if (name in this) {
                    Object.defineProperty(this.stringFields, name, {
                        get: () => this[name],
                        set: value => this[name] = value,
                        enumerable: true,
                        configurable: true,
                    });
                }
                if (this.xmlElement.hasAttribute(name)) {
                    this.stringFields[name] = this.xmlElement.getAttribute(name);
                }
            }
        }
        return this;
    }

    toString() {
        return "name" in this ? `${this.tagName}: ${this.name}` : `${this.tagName}`;
    }

    /** @param {string|Element} elementOrId */
    attachUI(elementOrId, bindUI = true) {
        if (!this.#initDone) this.init();
        this.uiElement = htmlElement(elementOrId);
        if (bindUI) this.bindUI();
        return this;
    }

    /** @param {Element} container @param {Element} insertBefore */
    spawnUI(container = this.parent?.uiElement, insertBefore = null, bindUI = true) {
        if (!this.#initDone) this.init();
        this.uiSpawned = true;
        const template = this["defaultTemplate"] ?? this.constructor["defaultTemplate"];
        if (typeof template !== "string") {
            throw new Error(`spawnUI for ${this.constructor.name} does not know how to spawn UI ☹`);
        }
        this.spawnUIFromTemplate(template, container, insertBefore);
        if (bindUI) this.bindUI();
        return this;
    }

    /** @param {string|DocumentFragment|Element} templateOrId @param {Element} container @param {Element} insertBefore */
    spawnUIFromTemplate(templateOrId, container = this.parent?.uiElement, insertBefore = null) {
        const clonedTemplate = typeof templateOrId === "string" ? cloneTemplate(templateOrId) : templateOrId;
        container.insertBefore(clonedTemplate, insertBefore);
        this.uiElement = htmlElement(clonedTemplate instanceof DocumentFragment ? container : clonedTemplate);
        if (this.uiElement.classList.contains("default-label")) {
            this.uiElement.setAttribute("label", this.toString());
        }
        return this.uiElement;
    }

    #uiBound = false;
    bindUI() {
        if (this.#uiBound) throw new Error("Attempting to re-bind UI!");
        if (!this.uiElement) return;
        for (const [name, required] of Object.entries(this.fieldRequirements ?? {})) {
            for (const element of /** @type {NodeListOf<HTMLValueElement>} */(this.uiElement.querySelectorAll(`[name="${name}"]`))) {
                element.addEventListener("input", evt => this.stringFields[name] = (!element.value?.length && !required) ? undefined : element.value);
            }
        }
        for (const evaluationField of this.uiElement.querySelectorAll(":is(.numericEvaluation,.conditionalEvaluation)[data-xml-name]")) {
            const isNumericEvaluation = evaluationField.classList.contains("numericEvaluation");
            const tagName = evaluationField.getAttribute("data-xml-name");
            const xmlChild = this.xmlElement.querySelector(tagName);
            const isOptional = evaluationField.hasAttribute("optional");
            const fieldElement =
                new (isNumericEvaluation ? NumericEvaluationElement : ConditionalEvaluationElement)
                    (this, xmlChild ?? tagName, isOptional).spawnUI(evaluationField);
            this.namedChildren[tagName] = fieldElement;
        }
        this.populateUIFields();
    }

    populateUIFields() {
        if (this.isOptional) {
            if (this.uiElement instanceof ListItem) {
                this.uiElement.present = this.isPresent;
            }
            const presenceCheckbox = this.uiElement.querySelector("input.elementPresent[type=checkbox]");
            if (presenceCheckbox) {
                inputElement(presenceCheckbox).checked = this.isPresent;
            }
        }
        for (const [name, value] of Object.entries(this.stringFields)) {
            const element = valueElement(this.uiElement?.querySelector(`[name="${name}"]`), false, false);
            if (element) {
                if (typeof value === "string" && value !== "") {
                    element.value = value;
                    element.setAttribute("value", value);
                } else {
                    element.removeAttribute("value");
                    element.value = "";
                }
            }
        }
    }
}

class BaseValueElement extends DataElement {
    static {
        this.defaultTemplate = "baseValueCalculationTemplate";
        this.addDefaultFields(
            ["tagName"],
            ["actionName",
             "skillName",
             "buffName",
             "resourceName",
             "functionName",
             "varName"]);
    }

    /** @type {readonly string[]} */
    lastBaseValueClasses = [];

    /** @param {BaseValueClass} className */
    hasBaseValueClass(className) {
        // @ts-ignore
        return isBaseValueType(this.tagName) && baseValueClasses[this.tagName]?.includes(className) === true;
    }

    changeBaseValueType(type="") {
        this.tagName = type;
        this.uiElement.dataset.baseValueType = type;
        if (!isBaseValueType(type)) {
            return;
        }
        const baseValueClass = baseValueClasses[type];
        this.uiElement.classList.remove(...this.lastBaseValueClasses);
        this.uiElement.classList.add(...baseValueClass);
        this.lastBaseValueClasses = baseValueClass;
    }

    bindUI() {
        super.bindUI();
        const typeSelect = valueElement(this.uiElement.querySelector(".baseValueType > select"));
        (typeSelect.onchange = () => this.changeBaseValueType(typeSelect.value))();
    }
}

class EvaluationRulesContainerElement extends DataElement {
    /** @type {EvaluationRuleElement[]} */
    rules = [];
    /** @type {HTMLElement} */
    rulesContainer;

    init() {
        super.init();
        for (const elem of this.xmlElement?.children ?? []) {
            if (elem.tagName in numericAdjustmentTypes || elem.tagName in conditionalRuleTypes) {
                this.rules.push(new EvaluationRuleElement(this, elem, true, true).init());
            }
        }
        return this;
    }

    bindUI() {
        super.bindUI();

        this.rulesContainer = htmlElement(this.uiElement.classList.contains("evaluationRules") ? this.uiElement : this.uiElement.querySelector(".evaluationRules"));
        for (const adj of this.rules) {
            adj.spawnUI(this.rulesContainer);
        }
    }
}

class ValueBearingElement extends EvaluationRulesContainerElement {
    static {
        this.addDefaultFields([], ["value"]);
    }
    static hasBaseValue = true;

    /** @type {string} */
    value;

    /** @type {BaseValueElement} */
    baseValue;

    /** @type {boolean} */
    hasBaseValue = this.constructor["hasBaseValue"] ?? false;

    get effectiveValue() {
        return this.value === "" ? this.baseValue : this.value;
    }

    init() {
        super.init();
        if (this.xmlElement?.childNodes.length === 1 && this.xmlElement.firstChild.nodeType === Node.TEXT_NODE && this.value == null) {
            const text = this.xmlElement.firstChild.nodeValue.trim();
            if (text.length) {
                this.value = text;
            }
        }
        if (isBaseValueType(this.xmlElement?.firstElementChild?.tagName ?? "")) {
            this.baseValue = new BaseValueElement(this, this.xmlElement.firstElementChild, true, true);
        }
        this.baseValue ??= new BaseValueElement(this, "", true, false);
        return this;
    }

    bindUI() {
        super.bindUI();
        if (this.hasBaseValue) {
            const baseValue = htmlElement(this.uiElement.querySelector(".baseValueCalculation"));
            this.baseValue.spawnUI(baseValue);
            const valueInput = inputElement(this.uiElement.querySelector("[name=value]"));
            valueInput?.addEventListener("input", () => this.baseValue.isPresent = valueInput.value === "");
        }
    }
}

class EvaluationRuleElement extends ValueBearingElement {
    static {
        this.defaultTemplate = "evaluationRuleTemplate";
        this.addDefaultFields(
            ["tagName"],
            ["statName",
             "skillName",
             "buffName",
             "prestigeBuffName",
             "storyFlagName",
             "resourceName",
             "adjustmentName",
             "actionName",
             "varName",
             "percentChange",
             "numericTest1", "numericTest1Value", "numericTest2", "numericTest2Value"]);
    }

    numericTest1 = "";
    numericTest1Value = "";
    numericTest2 = "";
    numericTest2Value = "";

    /** @type {readonly string[]} */
    lastRuleClasses = [];

    /** @template {RuleClass} C @param {C} className */
    hasRuleClass(className) {
        // @ts-ignore
        return isEvaluationRuleType(this.tagName) && ruleClasses[this.tagName]?.includes(className) === true;
    }

    init() {
        if (this.xmlElement) {
            for (const test of Object.keys(numericTestTypes)) {
                if (this.xmlElement.hasAttribute(test)) {
                    if (this.numericTest1 === "") {
                        this.numericTest1 = test;
                        this.numericTest1Value = this.xmlElement.getAttribute(test);
                    } else if (this.numericTest2 === "") {
                        this.numericTest2 = test;
                        this.numericTest2Value = this.xmlElement.getAttribute(test);
                    } else {
                        throw new Error(`Too many numeric tests: ${this.numericTest1}, ${this.numericTest2}, ${test} (this is a limitation of the editor, not the spec)`);
                    }
                }
            }
        }
        return super.init();
    }

    changeRuleType(type="") {
        this.uiElement.dataset.ruleType = type;
        if (!isEvaluationRuleType(type)) {
            return;
        }
        this.uiElement.classList.remove(...this.lastRuleClasses);
        this.uiElement.classList.add(...(this.lastRuleClasses = ruleClasses[type]));
        if (this.hasRuleClass("skillMod") && (this.numericTest1 !== "minExclusive" || this.numericTest2 !== "max")) {
            // just set the values in the select, CSS will prevent changes
            selectElement(this.uiElement.querySelector("select[name=numericTest1]")).value = "minExclusive";
            selectElement(this.uiElement.querySelector("select[name=numericTest2]")).value = "max";
            // and record that we've done so
            this.uiElement.classList.add("forced-skillMod");
        } else if (this.uiElement.classList.contains("forced-skillMod")) {
            this.uiElement.classList.remove("forced-skillMod");
            this.populateUIFields();
        }
    }

    bindUI() {
        super.bindUI();
        const typeSelect = valueElement(this.uiElement.querySelector("select[name=tagName]"));
        (typeSelect.onchange = () => this.changeRuleType(typeSelect.value))();
    }

    populateUIFields() {
        super.populateUIFields();
        if (this.rules.length > 0) {
            getElement(this.uiElement, ListItem).open = true;
        }
    }
}

class ConditionalEvaluationElement extends ValueBearingElement {
    static {
        this.defaultTemplate = "conditionalEvaluationTemplate";
        this.hasBaseValue = false;
    }

    /** @param {string} templateId @param {Element} container @param {Element} insertBefore */
    spawnUIFromTemplate(templateId, container = this.parent?.uiElement, insertBefore = null) {
        const uiElement = getElement(super.spawnUIFromTemplate(templateId, container, insertBefore), ListItem);

        return uiElement;
    }

    populateUIFields() {
        super.populateUIFields();
        if (this.rules.length > 0) {
            getElement(this.uiElement, ListItem).open = true;
        }
    }
}

class NumericEvaluationElement extends ConditionalEvaluationElement {
    static {
        this.defaultTemplate = "numericEvaluationTemplate";
        this.hasBaseValue = true;
    }
    /** @param {string} templateId @param {Element} container @param {Element} insertBefore */
    spawnUIFromTemplate(templateId, container = this.parent?.uiElement, insertBefore = null) {
        const uiElement = super.spawnUIFromTemplate(templateId, container, insertBefore);

        uiElement.label += ":";

        return uiElement;
    }

}

class NamedAdjustment extends EvaluationRulesContainerElement {
    static {
        this.defaultTemplate = "defineAdjustmentTemplate";
        this.addDefaultFields(["name"]);
    }
    /** @type {string} */
    name;

    toString() {
        return `Named Adjustment: ${this.name}`;
    }
}

class ActionDefinition extends DataElement {
    static {
        this.defaultTemplate = "actionDefinitionTemplate";
        this.addDefaultFields(["type", "name"], ["varName", "xmlName"]);
    }
    /** @satisfies {Record<ActionType, string>} */
    static validTypes = {
        normal: "Normal",
        limited: "Limited",
        progress: "Progress",
        multipart: "Multipart",
    }
    /** @param {string} type @returns {type is ActionType} */
    static isValidType(type) {
        return type in this.validTypes;
    }

    /** @type {ActionType} */
    type;
    /** @type {string} */
    name;

    get effectiveVarName() {
        return this.stringFields.varName ?? withoutSpaces(this.name);
    }

    toString() {
        return `${ActionDefinition.validTypes[this.type]} action: ${this.name}`;
    }

    init() {
        super.init();
        this.name ??= "";
        const literalType = this.xmlElement?.getAttribute("type");
        this.type = ActionDefinition.isValidType(literalType) ? literalType : "normal";
        if (!ActionDefinition.validTypes[this.type]) {
            console.warn(`Unknown or missing type ${this.type}, treating as normal action`, this, this.xmlElement);
            this.type = "normal";
        }
        return this;
    }

    updateNameDerivations() {
        this.updatePlaceholder("[name=varName]", withoutSpaces(this.name));
        this.updatePlaceholder("[name=xmlName]", getXMLName(this.name));
    }
    updatePlaceholder(inputSelector, placeholderValue) {
        const element = inputElement(this.uiElement.querySelector(inputSelector));
        element.placeholder = placeholderValue;
    }

    bindUI() {
        super.bindUI();
        const typeSelect = valueElement(this.uiElement.querySelector("select[name=type]"));
        (typeSelect.onchange = () => this.uiElement.dataset.actionType = typeSelect.value)();
    }

    populateUIFields() {
        super.populateUIFields();
        this.updateNameDerivations();
    }
}

function setValueAttribute(event) {
    const target = valueElement(event.target, false, false);
    if (!target || target.type === "checkbox" || target.type === "radio") return;
    const {value} = target;
    if (value === "" || value == null) {
        target.removeAttribute("value");
    } else {
        target.setAttribute("value", value);
    }
}

/**
 * @template {string|number|symbol} K
 * @template {*} V
 */
class DataListBinding {
    static identity(x) {
        return x;
    }

    /** @type {HTMLDataListElement} */
    list;
    /** @type {Record<K, V>|V[]} */
    optionsSource;
    /** @type {(value: V, key: K) => string|string[]|false} */
    labelFunc;
    /** @type {(key: K, value: V) => string|false} */
    keyFunc;
    /** @type {(value: V, key: K) => string} */
    classFunc;

    /**
     * @param {string|Element} listId
     * @param {Record<K, V>|V[]} optionsSource
     * @param {(value: V, key: K) => string|string[]|false} labelFunc
     * @param {(key: K, value: V) => string|false} keyFunc
     * @param {(value: V, key: K) => string} [classFunc]
     */
    constructor(listId, optionsSource, labelFunc = DataListBinding.identity, keyFunc = DataListBinding.identity, classFunc) {
        this.list = getElement(listId, HTMLDataListElement);
        this.optionsSource = optionsSource;
        this.labelFunc = labelFunc;
        this.keyFunc = keyFunc;
        this.classFunc = classFunc;
    }

    updateFromSource() {
        let isDirty = false;
        /** @type {Record<string, HTMLOptionElement>} */
        const currentOptions = {};
        /** @type {Record<string, boolean>} */
        const seenOptionKeys = {};
        for (const option of this.list.options) {
            currentOptions[`${option.value}\0${option.text}`] = option;
        }
        const newOptions = [];
        for (const [sourceKey, sourceValue] of /** @type {[K,V][]} */(Object.entries(this.optionsSource))) {
            const optionLabels = this.labelFunc(sourceValue, sourceKey);
            const optionLabel = Array.isArray(optionLabels) ? optionLabels[0] : optionLabels;
            const optionValue = this.keyFunc(sourceKey, sourceValue);
            const optionClass = this.classFunc?.(sourceValue, sourceKey) ?? "";
            if (optionValue === false || optionLabel === false) continue;
            const optionKey = `${optionValue}\0${optionLabel}`;
            if (seenOptionKeys[optionKey]) {
                console.warn("Already saw option with value and label:", optionValue, optionLabel);
            }
            seenOptionKeys[optionKey] = true;
            let newOption = currentOptions[optionKey];
            if (!newOption) {
                newOption = new Option(optionLabel, optionValue);
                isDirty = true;
            }
            if (optionClass !== newOption.className) {
                newOption.className = optionClass;
                isDirty = true;
            }
            if (Array.isArray(optionLabels)) {
                for (const [index, label] of optionLabels.slice(1).entries()) {
                    const key = `extraLabel-${index + 1}`;
                    if (newOption.dataset[key] !== (label || undefined)) {
                        newOption.dataset[key] = (label || undefined);
                        isDirty = true;
                    }
                }
            }
            newOptions.push(newOption);
        }
        if (isDirty) {
            this.list.replaceChildren(...newOptions);
            this.updateAllOptions();
        }
        return isDirty;
    }

    /** @param {Document|DocumentFragment|Element} [context]  */
    updateAllOptions(context = document) {
        for (const container of context.querySelectorAll(`.fromDataList[data-list="${this.list.id}"]`)) {
            this.updateOptionsFromList(htmlElement(container));
        }
    }

    /** @param {HTMLElement} container @param {string} [currentValue] */
    updateOptionsFromList(container, currentValue) {
        // check the container and its parent, in case container is an <optgroup>
        const valueHolder = valueElement(container, false, false) ?? valueElement(container.parentElement);
        currentValue ??= valueHolder.getAttribute("value") ?? "";
        const oldValue = valueHolder.value;
        const emptyOptionLabel = container.dataset.emptyOptionLabel;
        /** @type {HTMLOptionElement[]} */
        const newOptions = [];
        if (typeof emptyOptionLabel === "string") {
            newOptions.push(new Option(emptyOptionLabel, "", currentValue === "", currentValue === ""));
        }
        for (const {value, text, className, dataset} of this.list.options) {
            const newOption = new Option(text, value, value === currentValue, value === currentValue);
            newOption.className = className;
            for (const [key, value] of Object.entries(dataset)) {
                newOption.dataset[key] = value;
            }
            newOptions.push(newOption);
        }
        container.replaceChildren(...newOptions);
        if (valueHolder.value !== oldValue && (valueHolder.value === currentValue || container === valueHolder)) {
            valueHolder.dispatchEvent(new Event("input", {
                bubbles: true,
                cancelable: true,
            }));
            valueHolder.dispatchEvent(new Event("change", {
                bubbles: true,
                cancelable: true,
            }));
        }
    }
}

class ActionListEditor {
    /** @readonly @type {NamedAdjustment[]} */
    defs = [];
    /** @readonly @type {ActionDefinition[]} */
    actions = [];
    url = "";
    xmlText = "";
    /** @type {XMLDocument} */
    xmlDoc;

    /** @type {Record<string, DataListBinding>} */
    dataListBindings = {__proto__: null};

    windowBound = false;

    init() {
        this.defs.length = 0;
        this.actions.length = 0;

        if (!this.windowBound) {
            this.windowBound = true;

            this.bindDataList("skills", skills, s => s.label);
            this.bindDataList("buffs", buffs, b => !(b.name in prestigeBases) && b.label);
            this.bindDataList("prestigeBuffs", buffs, b => b.name in prestigeBases && b.label);
            this.bindDataList("storyFlags", storyFlags, (_, k) => k);
            this.bindDataList("jsFunctions", Schema.jsFunctions, (_, k) => k);
            this.bindDataList("resources", resources, (_, k) => _txt(`tracked_resources>resource[id=${k}]>label`), k => k, v => typeof v);
            this.bindDataList("namedAdjustments", this.defs, d => d.name, (_, d) => d.name);
            this.bindDataList("actionNames", this.actions, a => a.name, (_,a) => a.name, a => a.type);
            this.bindDataList("varNames", this.actions, a => a.name, (_,a)=>a.effectiveVarName, a => a.type);
            this.bindDataList("baseValueTypes", baseValueTypes);
            this.bindDataList("numericTestTypes", numericTestTypes);
            this.bindDataList("numericAdjustmentTypes", numericAdjustmentTypes);
            this.bindDataList("conditionalRuleTypes", conditionalRuleTypes);
        }

        return this;
    }

    /**
     * @template {string|number|symbol} K
     * @template {*} V
     * @param {string} listId
     * @param {Record<K, V>|V[]} options
     * @param {(value: V, key: K) => string|false} [labelFunc]
     * @param {(key: K, value: V) => string|false} [keyFunc]
     * @param {(value: V, key: K) => string} [classFunc]
     */
    bindDataList(listId, options, labelFunc, keyFunc, classFunc) {
        this.dataListBindings[listId] = (new DataListBinding(listId, options, labelFunc, keyFunc, classFunc));
    }

    updateDataLists() {
        for (const binding of Object.values(this.dataListBindings)) {
            if (binding.updateFromSource()) {
                for (const template of document.getElementsByTagName("template")) {
                    binding.updateAllOptions(template.content);
                }
            }
        }
    }

    /** @param {HTMLElement} container @param {string} [currentValue] */
    updateOptions(container, currentValue) {
        if (!container.classList.contains("fromDataList")) return;
        const listId = container.dataset.list;
        this.dataListBindings[listId].updateOptionsFromList(container, currentValue);
    }

    /** @param {string} url  */
    async load(url) {
        this.url = url;
        const res = await fetch(url);
        this.xmlText = await res.text();
        const parser = new DOMParser();
        this.xmlDoc = parser.parseFromString(this.xmlText, "text/xml");
        const actionsElement = this.xmlDoc.querySelector("actions:root");
        const defsElement = this.xmlDoc.querySelector("actions:root>defs");
        this.actionsElement = new DataElement(null, actionsElement ?? "actions").attachUI("actions");
        this.defsElement = new DataElement(this.actionsElement, defsElement ?? "defs").attachUI("defs");
        if (defsElement) {
            for (const child of defsElement.children) {
                if (child.namespaceURI !== null) {
                    continue;
                }
                if (child.tagName === "defineAdjustment") {
                    this.defs.push(new NamedAdjustment(this.defsElement, child).spawnUI());
                } else {
                    console.warn("Got unexpected child of <defs>, ignoring:", child);
                }
            }
        }
        if (actionsElement) {
            for (const child of actionsElement.children) {
                if (child.tagName === "defs" || child.namespaceURI !== null) {
                    // defs element and out-of-namespaces elements are ignored
                    continue;
                }
                if (child.tagName === "action") {
                    this.actions.push(new ActionDefinition(this.actionsElement, child).spawnUI());
                } else {
                    console.warn("Got unexpected child of <actions>, ignoring:", child);
                }
            }
        }
        this.updateDataLists();
    }
}

let editor = new ActionListEditor();

async function startEditor() {
    console.log("Loading defaults...")
    loadDefaults();
    console.log("Waiting for localization framework...");
    await Localization.ready;
    console.log("Starting editor...");
    await editor.init().load("data/actionList.xml");
    console.log(`Loaded ${editor.url}`);
}

