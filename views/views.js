/**
 * @typedef ViewDefinition
 * @prop {string} selector
 * @prop {() => string} html
 */
/**
 * @typedef {{
 *  menu: typeof menuView,
 *  buffsContainer: typeof buffsView,
 *  talentTree: typeof talentTreeView,
 *  timeControls: typeof timeControlsView,
 *  trackedResources: typeof trackedResourcesView,
 * }} ViewTypes
 * @typedef {keyof ViewTypes} ViewName
 * 
 * @type {{
 *  debug: boolean,
 *  views: ViewName[],
 *  registerView<N extends ViewName, V extends ViewDefinition>(viewName: N, view: V): V,
 *  draw(): void,
 * } & Partial<ViewTypes>}
 */
const Views = window['Views'] = {
    // activates verbose mode
    debug: true,
    // a vue can be registered if it implements an html function, that returns the html
    // once a view VIEWNAME is registered, it can be called using Views.VIEWNAME
    /** @type {<N extends ViewName, V extends ViewDefinition>(viewName: N, view: V) => V} */
    registerView(viewName, view) {
        let canDraw = true;
        // error handling
        if (typeof (viewName) === "string") {
            if (typeof (Views[viewName]) !== "undefined") {
                if (Views.debug)
                    console.warn(`Overriding the vue ${viewName} because another view has been registered with the same viewName.`);
                // the view overriten won't be drawn because :
                // it's either the same view registered, and is already planed to be drawn
                // or it's another view, and this warning should be taken seriously.
                // this case doesn't return false because in some case you could have multiple registrations of the same view.
                canDraw = false;
            }
        } else {
            console.error("Trying to register a view without giving a viewName.");
            return null;
        }
        // this isn't blocking, a vue can exist without being drawn
        if (typeof (view.selector) === "undefined") {
            if (Views.debug)
                console.warn(`Trying to register view ${viewName} but the view doesn't have a selector key, it won't be drawn.`);
            canDraw = false;
        }
        if (typeof (view.html) === "undefined") {
            if (typeof (view.selector) !== "undefined") {
                console.error(`Trying to register view ${viewName} with a selector but no html method. View not registered.`);
                return null;
            }
        }
        if (canDraw)
            Views.views.push(viewName);
        // @ts-ignore
        Views[viewName] = view;
        return view;
    },
    views: [],
    draw() {
        for (const viewName of Views.views) {
            $(Views[viewName].selector).html(Views[viewName].html());
        };
    }
};
