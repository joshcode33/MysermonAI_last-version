/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as bible from "../bible.js";
import type * as bibleAdmin from "../bibleAdmin.js";
import type * as generation from "../generation.js";
import type * as http from "../http.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_ai_config from "../lib/ai/config.js";
import type * as lib_ai_errors from "../lib/ai/errors.js";
import type * as lib_ai_orchestrator from "../lib/ai/orchestrator.js";
import type * as lib_ai_params from "../lib/ai/params.js";
import type * as lib_ai_parse from "../lib/ai/parse.js";
import type * as lib_ai_prompts from "../lib/ai/prompts.js";
import type * as lib_ai_providers_http from "../lib/ai/providers/http.js";
import type * as lib_ai_providers_index from "../lib/ai/providers/index.js";
import type * as lib_ai_providers_ollama from "../lib/ai/providers/ollama.js";
import type * as lib_ai_providers_openaiCompatible from "../lib/ai/providers/openaiCompatible.js";
import type * as lib_ai_section from "../lib/ai/section.js";
import type * as lib_ai_sermonSchema from "../lib/ai/sermonSchema.js";
import type * as lib_bible_books from "../lib/bible/books.js";
import type * as lib_bible_queries from "../lib/bible/queries.js";
import type * as lib_bible_reference from "../lib/bible/reference.js";
import type * as lib_bible_sources from "../lib/bible/sources.js";
import type * as lib_bible_validateFile from "../lib/bible/validateFile.js";
import type * as lib_plans from "../lib/plans.js";
import type * as lib_sermonTypes from "../lib/sermonTypes.js";
import type * as lib_session from "../lib/session.js";
import type * as sermons from "../sermons.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  bible: typeof bible;
  bibleAdmin: typeof bibleAdmin;
  generation: typeof generation;
  http: typeof http;
  "lib/access": typeof lib_access;
  "lib/ai/config": typeof lib_ai_config;
  "lib/ai/errors": typeof lib_ai_errors;
  "lib/ai/orchestrator": typeof lib_ai_orchestrator;
  "lib/ai/params": typeof lib_ai_params;
  "lib/ai/parse": typeof lib_ai_parse;
  "lib/ai/prompts": typeof lib_ai_prompts;
  "lib/ai/providers/http": typeof lib_ai_providers_http;
  "lib/ai/providers/index": typeof lib_ai_providers_index;
  "lib/ai/providers/ollama": typeof lib_ai_providers_ollama;
  "lib/ai/providers/openaiCompatible": typeof lib_ai_providers_openaiCompatible;
  "lib/ai/section": typeof lib_ai_section;
  "lib/ai/sermonSchema": typeof lib_ai_sermonSchema;
  "lib/bible/books": typeof lib_bible_books;
  "lib/bible/queries": typeof lib_bible_queries;
  "lib/bible/reference": typeof lib_bible_reference;
  "lib/bible/sources": typeof lib_bible_sources;
  "lib/bible/validateFile": typeof lib_bible_validateFile;
  "lib/plans": typeof lib_plans;
  "lib/sermonTypes": typeof lib_sermonTypes;
  "lib/session": typeof lib_session;
  sermons: typeof sermons;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
