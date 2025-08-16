// @ts-check
"use strict";

class Polyfill {
    isNeeded = false;

    /** @param {boolean|(() => boolean)} [isNeeded] @param {() => Promise} [execute] */
    constructor(isNeeded, execute) {
        if (isNeeded != undefined) {
            Object.defineProperty(this, "isNeeded", {
                configurable: true,
                ...(typeof isNeeded === "boolean" ? {value: isNeeded} : {get: isNeeded}),
            });
        }
        if (execute) {
            this.execute = execute;
        }
    }
    get order() {
        return 0;
    }

    get name() {
        const name = Object.entries(polyfills).find(([k,v]) => v === this)?.[0];
        if (name != undefined) {
            Object.defineProperty(this, "name", {configurable: true, value: name})
        }
        return name;
    }

    async execute() {
    }
}

// This won't work if the CSS has /* characters in a string, so so maybe let's not do that okay
const reComments = /\/\*[^]*?\*\//g;
const reNestedRule = /(?:(?<=[{};])|^)(?<outerSelector>\s*[^{};\s][^{};]*){(?<outerEarly>(?:[^;{}]*;)*(\s*\n)?)(?<innerSelector>[^{};&]*?&[^{};]*){(?<innerRule>[^{}]*)}/g;

class CSSNestingPolyfill extends Polyfill {
    isNeeded = !CSS.supports("selector(&)");

    /** @type {Map<HTMLElement, Promise<StyleSheet>>} */
    processedStylesheets = new Map();

    /** @type {(link: HTMLLinkElement) => Promise<StyleSheet>} */
    async processRemoteSheet(link) {
        if (window.origin && !link.href.startsWith(window.origin)) return link.sheet;
        const response = await fetch(link.href);
        const text = await response.text();
        if (!text.includes("&")) return link.sheet;

        const styleElement = document.createElement("style");
        link.disabled = true;
        link.insertAdjacentElement("afterend", styleElement);
        return await this.processSheet(styleElement, text);
    }
    /** @type {(styleElement: HTMLStyleElement, cssText: string) => Promise<StyleSheet>} */
    async processSheet(styleElement, text) {
        text = text.replace(reComments, " ");

        while (reNestedRule.test(text)) {
            text = text.replace(reNestedRule, (...args) => {
                const g = args.at(-1);
                return this.nestSelectors(g.outerSelector, g.outerEarly, g.innerSelector, g.innerRule);
            })
        }

        styleElement.textContent = text;
        return styleElement.sheet;
    }
    /** @type {(outer: string, early: string, inner: string, rule: string) => string} */
    nestSelectors(outerSelector, outerEarly, innerSelector, innerRule) {
        const outerVariants = outerSelector.split(",");
        const innerVariants = innerSelector.split(",");
        const variants = [];
        for (const outer of outerVariants) {
            for (const inner of innerVariants) {
                variants.push(inner.includes("&") ? inner.trim().replace("&", outer.trim()) : `${outer.trim()} ${inner.trim()}`);
            }
        }
        const segments = [];
        const [, preLine="", outerIndent, outerTrimmed] = outerSelector.match(/^(\s*\n)?(\s*)(.*)$/s) ?? [,"","",outerSelector];
        const [, innerIndent] = innerSelector.match(/^(\s*)/s);
        if (outerEarly.trim().length) {
            segments.push(outerSelector, '{', outerEarly, '}\n');
        } else {
            segments.push(preLine);
        }
        segments.push(innerIndent, variants.join(", "), '{', innerRule, '}\n');
        segments.push(outerIndent, outerTrimmed, '{');
        return segments.join("");
    }

    async execute() {
        for (const linkElement of Array.from(document.getElementsByTagName("link"))) {
            if (this.processedStylesheets.has(linkElement)) continue;
            if (!linkElement.relList.contains("stylesheet")) continue;
            this.processedStylesheets.set(linkElement, this.processRemoteSheet(linkElement));
        }
        await Promise.allSettled(this.processedStylesheets.values());
    }
}

/** @type {Record<string, Polyfill>} */
const polyfills = {
    cssNesting: new CSSNestingPolyfill(),
}

const neededPolyfills = Object.values(polyfills).filter((p) => p.isNeeded).sort((p1, p2) => p1.order - p2.order);
Object.freeze(neededPolyfills);
neededPolyfills.forEach(p => p.execute());