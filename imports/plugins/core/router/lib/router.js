import React from "react";
import { Route } from "react-router";
import { createBrowserHistory, createMemoryHistory } from "history";
import pathToRegexp from "path-to-regexp";
import queryParse from "query-parse";
import Immutable from "immutable";
import { uniqBy } from "lodash";
import { Meteor } from "meteor/meteor";
import Blaze from "meteor/gadicc:blaze-react-component";
import { Template } from "meteor/templating";
import { Session } from "meteor/session";
import { Tracker } from "meteor/tracker";
import { Shops } from "/lib/collections";
import { getComponent } from "@reactioncommerce/reaction-components/components";
import Hooks from "./hooks";

// Using a ternary operator here to avoid a mutable export - open to suggestions for a better way to do this
export const history = Meteor.isClient ? createBrowserHistory() : createMemoryHistory();

const layouts = [
  {
    layout: "coreLayout",
    workflow: "coreAccountsWorkflow",
    collection: "Accounts",
    theme: "default",
    enabled: true,
    structure: {
      template: "accountsDashboard",
      layoutHeader: "NavBar",
      layoutFooter: "",
      notFound: "notFound",
      dashboardHeader: "dashboardHeader",
      dashboardControls: "",
      dashboardHeaderControls: "",
      adminControlsFooter: "adminControlsFooter"
    }
  },
  {
    layout: "coreLayout",
    workflow: "coreWorkflow",
    theme: "default",
    enabled: true,
    structure: {
      template: "products",
      layoutHeader: "NavBar",
      layoutFooter: "Footer",
      notFound: "productNotFound",
      dashboardControls: "dashboardControls",
      adminControlsFooter: "adminControlsFooter"
    }
  },
  {
    layout: "coreLayout",
    workflow: "coreWorkflow",
    theme: "default",
    enabled: true,
    structure: {
      template: "unauthorized",
      layoutHeader: "NavBar",
      layoutFooter: "Footer"
    }
  },
  {
    layout: "coreLayout",
    workflow: "coreEmailWorkflow",
    theme: "default",
    enabled: true,
    structure: {
      template: "email",
      layoutHeader: "NavBar",
      layoutFooter: "",
      notFound: "notFound",
      dashboardHeader: "dashboardHeader",
      dashboardControls: "dashboardControls",
      adminControlsFooter: "adminControlsFooter"
    }
  },
  {
    layout: "coreLayout",
    workflow: "coreTagWorkflow",
    theme: "default",
    enabled: true,
    structure: {
      template: "tagSettings",
      layoutHeader: "NavBar",
      layoutFooter: "",
      notFound: "notFound",
      dashboardHeader: "dashboardHeader",
      dashboardControls: "dashboardControls",
      adminControlsFooter: "adminControlsFooter"
    }
  },
  {
    layout: "coreLayout",
    workflow: "coreDashboardWorkflow",
    theme: "default",
    enabled: true,
    structure: {
      template: "dashboardPackages",
      layoutHeader: "NavBar",
      layoutFooter: "",
      notFound: "notFound",
      dashboardHeader: "dashboardHeader",
      dashboardControls: "dashboardControls",
      dashboardHeaderControls: "dashboardHeaderControls",
      adminControlsFooter: "adminControlsFooter"
    }
  }
];

// Private vars
let currentRoute = Immutable.Map();
const routerReadyDependency = new Tracker.Dependency();
const routerChangeDependency = new Tracker.Dependency();

/** Class representing a static base router */
class Router {
  /**
   * history
   * @type {history}
   */
  static history = history

  /**
   * Hooks
   * @type {Hooks}
   */
  static Hooks = Hooks

  /**
   * Registered route definitions
   * @type {Array}
   */
  static routes = []

  /**
   * Router initialization state
   * @type {Boolean}
   */
  static _initialized = false;

  /**
   * Active classname for active routes
   * @type {String}
   */
  static activeClassName = "active";

  /**
   * Routes array
   * @type {Array}
   * @param {Array} value An array of objects
   */
  static set _routes(value) {
    Router.routes = value;
  }

  static get _routes() {
    return Router.routes;
  }

  /**
   * Triggers reactively on router ready state changed
   * @returns {Boolean} Router initialization state
   */
  static ready() {
    routerReadyDependency.depend();
    return Router._initialized;
  }

  /**
   * Re-triggers router ready dependency
   * @returns {undefined}
   */
  static triggerRouterReady() {
    routerReadyDependency.changed();
  }

  /**
   * Hooks
   * @type {Hooks}
   */
  static get triggers() {
    return Hooks;
  }

  /**
   * Get the current route date. Not reactive.
   * @returns {Object} Object containing route data
   */
  static current() {
    return currentRoute.toJS();
  }

  /**
   * Set current route data. Is reactive.
   * @param {Object} routeData Object containing route data
   * @returns {undefined}
   */
  static setCurrentRoute(routeData) {
    currentRoute = Immutable.Map(routeData);
    routerChangeDependency.changed();
  }

  /**
   * Get the name of the current route. Is reactive.
   * @returns {String} Name of current route
   */
  static getRouteName() {
    const current = Router.current();

    return (current.route && current.route.name) || "";
  }

  /**
   * Get param by name. Is reactive.
   * @param  {String} name Param name
   * @returns {String|undefined} String value or undefined
   */
  static getParam(name) {
    routerChangeDependency.depend();
    const current = Router.current();

    return (current.params && current.params[name]) || undefined;
  }

  /**
   * Get query param by name
   * @param  {String} name Query param name. Is reactive.
   * @returns {String|undefined} String value or undefined
   */
  static getQueryParam(name) {
    routerChangeDependency.depend();
    const current = Router.current();

    return (current.query && current.query[name]) || undefined;
  }

  /**
   * Merge new query params with current params
   * @param {Object} newParams Object containing params
   * @returns {undefined}
   */
  static setQueryParams(newParams) {
    const current = Router.current();

    // Merge current and new params
    const queryParams = Object.assign({}, current.query, newParams);

    // Any param marked as null or undefined will be removed
    for (const key in queryParams) {
      if (queryParams[key] === null || queryParams[key] === undefined) {
        delete queryParams[key];
      }
    }

    // Update route
    Router.go(current.route.name, current.params, queryParams);
  }

  /**
   * Watch path change. Is Reactive.
   * @returns {undefined}
   */
  static watchPathChange() {
    routerChangeDependency.depend();
  }
}

/**
 * @summary get current router path
 * @param {String} path - path to fetch
 * @param {Object} options - url params
 * @returns {String} returns current router path
 */
Router.pathFor = (path, options = {}) => {
  const foundPath = Router.routes.find((pathObject) => {
    if (pathObject.route) {
      if (options.hash && options.hash.shopSlug) {
        if (pathObject.options.name === path && pathObject.route.includes("shopSlug")) {
          return true;
        }
      } else if (pathObject.options.name === path && !pathObject.route.includes("shopSlug")) {
        return true;
      }
    }

    // No path found
    return false;
  });

  if (foundPath) {
    // Pull the hash out of options
    //
    // This is because of Spacebars that we have hash.
    // Spacebars takes all params passed into a template tag and places
    // them into the options.hash object. This will also include any `query` params
    const hash = (options && options.hash) || {};

    // Create an executable function based on the route regex
    const toPath = pathToRegexp.compile(foundPath.route);

    // Compile the regex path with the params from the hash
    const compiledPath = toPath(hash);

    // Convert the query object to a string
    // e.g. { a: "one", b: "two"} => "a=one&b=two"
    const queryString = queryParse.toString(hash.query);

    // Return the compiled path + query string if we have one
    if (typeof queryString === "string" && queryString.length) {
      return `${compiledPath}?${queryString}`;
    }

    // Return only the compiled path
    return compiledPath;
  }

  return "/";
};

/**
 * Navigate to path with params and query
 * @param  {String} path Path string
 * @param  {Object} params Route params object
 * @param  {Object} query Query params object
 * @returns {undefined} undefined
 */
Router.go = (path, params, query) => {
  let actualPath;

  const routerGo = () => {
    if (typeof path === "string" && path.startsWith("/")) {
      actualPath = path;
    } else {
      actualPath = Router.pathFor(path, {
        hash: {
          ...params,
          query
        }
      });
    }

    if (window) {
      history.push(actualPath);
    }
  };

  // if Router is in a non ready/initialized state yet, wait until it is
  if (!Router.ready()) {
    Tracker.autorun((routerReadyWaitFor) => {
      if (Router.ready()) {
        routerReadyWaitFor.stop();
        routerGo();
      }
    });

    return;
  }

  routerGo();
};

/**
 * Replace location
 * @param  {String} path Path string
 * @param  {Object} params Route params object
 * @param  {Object} query Query params object
 * @returns {undefined} undefined
 */
Router.replace = (path, params, query) => {
  const actualPath = Router.pathFor(path, {
    hash: {
      ...params,
      query
    }
  });

  if (window) {
    history.replace(actualPath);
  }
};

/**
 * Reload router
 * @returns {undefined} undefined
 */
Router.reload = () => {
  const current = Router.current();

  if (window) {
    history.replace(current.route.fullPath || "/");
  }
};

/**
 * isActive
 * @summary general helper to return "active" when on current path
 * @example {{active "name"}}
 * @param {String} routeName - route name as defined in registry
 * @returns {String} return "active" or null
 */
Router.isActiveClassName = (routeName) => {
  const current = Router.current();
  const { group } = current.route;
  let prefix = "";

  if (current.route) {
    const { path } = current.route;

    if (group && group.prefix) {
      ({ prefix } = current.route.group);
    }

    // Match route
    if (prefix.length && routeName.startsWith(prefix) && path === routeName) {
      // Route name is a path and starts with the prefix. (default '/reaction')
      return Router.activeClassName;
    } else if (routeName.startsWith("/") && path === routeName) {
      // Route name isa  path and starts with slash, but was not prefixed
      return Router.activeClassName;
    } else if (current.route.name === routeName) {
      // Route name is the actual name of the route
      return Router.activeClassName;
    }
  }

  return "";
};

/**
 * selectLayout
 * @param {Object} layout - element of shops.layout array
 * @param {Object} setLayout - layout
 * @param {Object} setWorkflow - workflow
 * @returns {Object} layout - return object of template definitions for Blaze Layout
 * @private
 */
function selectLayout(layout, setLayout, setWorkflow) {
  const currentLayout = setLayout || Session.get("DEFAULT_LAYOUT") || "coreLayout";
  const currentWorkflow = setWorkflow || Session.get("DEFAULT_WORKFLOW") || "coreWorkflow";
  if (layout.layout === currentLayout && layout.workflow === currentWorkflow && layout.enabled === true) {
    return layout;
  }
  return null;
}

/**
 * @name ReactionLayout
 * @method
 * @summary sets and returns reaction layout structure
 * @param {Object} options - this router context
 * @param {String} options.layout - string of shop.layout.layout (defaults to coreLayout)
 * @param {String} options.workflow - string of shop.layout.workflow (defaults to coreLayout)
 * @returns {Object} layout - return object of template definitions for Blaze Layout
 * @private
 */
function ReactionLayout(options = {}) {
  // Find a workflow layout to render

  // Get the shop data
  const shopId = Router.Reaction.getPrimaryShopId();
  const shop = Shops.findOne({ _id: shopId });

  // get the layout & workflow from options if they exist
  // Otherwise get them from the Session. this is set in `/client/config/defaults`
  // Otherwise, default to hard-coded values
  const layoutName = options.layout || Session.get("DEFAULT_LAYOUT") || "coreLayout";
  const workflowName = options.workflow || Session.get("DEFAULT_WORKFLOW") || "coreWorkflow";

  // Layout object used to render
  // Defaults provided for reference
  let layoutStructure = {
    template: "",
    layoutHeader: "",
    layoutFooter: "",
    notFound: "notFound",
    dashboardHeader: "",
    dashboardControls: "",
    dashboardHeaderControls: "",
    adminControlsFooter: ""
  };

  // Find a registered layout using the layoutName and workflowName
  if (shop) {
    const foundLayout = layouts.find((layout) => selectLayout(layout, layoutName, workflowName));

    if (foundLayout) {
      if (foundLayout.structure) {
        layoutStructure = {
          ...foundLayout.structure
        };
      }
    }
  }

  // If the original options did not include a workflow, but did have a template,
  // then we override the template from the layout with the one provided by the options.
  //
  // Why is this? We always need a workflow to render the entire layout of the app.
  // The default layout has a default template that may not be the one we want to render.
  // Some routes, such as `/account/profile` do no have a workflow, but define a template.
  // Without the logic below, it would end up rendering the homepage instead of the profile
  // page.
  // const optionsHasWorkflow = typeof options.workflow === "string";
  const optionsHasTemplate = typeof options.template === "string";

  if (optionsHasTemplate) {
    layoutStructure.template = options.template;
  }

  // If there is no Blaze Template (Template[]) or React Component (getComponent)
  // Then use the notFound template instead
  let hasReactComponent = true;

  try {
    getComponent(layoutStructure.template);
  } catch (error) {
    hasReactComponent = false;
  }

  if (!Template[layoutStructure.template] && !hasReactComponent) {
    return (
      <Blaze template={layoutStructure.notFound} />
    );
  }

  // Render the layout
  return {
    theme: "default",
    structure: layoutStructure,
    component: (props) => { // eslint-disable-line react/no-multi-comp, react/display-name
      const structure = {
        ...layoutStructure
      };

      try {
        // Try to create a React component if defined
        return React.createElement(getComponent(layoutName), {
          ...props,
          structure
        });
      } catch (error) {
        // eslint-disable-next-line
        console.warn(e, "Failed to create a React layout element");
      }
      // If all else fails, render a not found page
      return <Blaze template={structure.notFound} />;
    }
  };
}

/**
 * initPackageRoutes
 * registers route and template when registry item has
 * registryItem.route && registryItem.template
 * @param {Object} options - options and context for route creation
 * @returns {undefined} returns undefined
 */
Router.initPackageRoutes = (options) => {
  // make _initialized = false in case router is reinitialized
  Router._initialized = false;
  routerReadyDependency.changed();

  Router.Reaction = options.reactionContext;
  Router.routes = [];

  // Default layouts
  const indexLayout = ReactionLayout(options.indexRoute);
  const defaultNotFoundLayout = ReactionLayout({ template: "notFound" });

  const allRouteDefinitions = [{
    route: "/",
    name: "index",
    options: {
      name: "index",
      ...options.indexRoute,
      theme: indexLayout.theme,
      component: indexLayout.component,
      structure: indexLayout.structure
    }
  }, {
    route: "shop/:shopSlug",
    name: "index",
    options: {
      name: "index",
      type: "shop-prefix",
      ...options.indexRoute,
      theme: indexLayout.theme,
      component: indexLayout.component,
      structure: indexLayout.structure
    }
  }, {
    route: "/not-found",
    name: "not-found",
    options: {
      name: "not-found",
      ...defaultNotFoundLayout.indexRoute,
      theme: defaultNotFoundLayout.theme,
      component: defaultNotFoundLayout.component,
      structure: defaultNotFoundLayout.structure
    }
  }];

  // Uniq-ify routes
  // Take all route definitions in the order that were received, and reverse it.
  // Routes defined later, like in the case of custom routes will then have a
  // higher precedence. Any duplicates after the first instance will be removed.
  //
  // TODO: In the future, sort by priority
  // TODO: Allow duplicated routes with a prefix / suffix / flag
  const uniqRoutes = uniqBy(allRouteDefinitions.reverse(), "route");
  const reactRouterRoutes = uniqRoutes.map((route, index) => (
    <Route
      key={`${route.name}-${index}`}
      path={`/:shopId${route.route}`}
      exact={true}
      render={route.options.component}
    />
  ));

  const index = allRouteDefinitions.find((route) => route.name === "index") || {};
  const indexComponent = index.options && index.options.component;

  reactRouterRoutes.push((
    <Route
      key="index"
      path="/"
      exact={true}
      render={indexComponent}
    />
  ));

  // Last route, if no other route is matched, this one will be the not-found view
  // Note: This is last because all other routes must at-least attempt a match
  // before falling back to this not-found route.
  const notFound = allRouteDefinitions.find((route) => route.name === "not-found") || {};
  const notFoundComponent = notFound.options && notFound.options.component;
  reactRouterRoutes.push((
    <Route
      key="not-found"
      render={notFoundComponent}
    />
  ));

  // Finish initialization
  Router._initialized = true;
  Router.reactComponents = reactRouterRoutes;
  Router._routes = uniqRoutes;

  // Trigger a reactive refresh to re-render routes
  routerReadyDependency.changed();
};


export default Router;
