import { z, type ZodRawShape, type ZodObject } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { SessionRegistry } from "../session/SessionRegistry.js";
import type { ArtifactStore } from "../artifact/ArtifactStore.js";

export type ToolContext = {
  registry: SessionRegistry;
  store: ArtifactStore;
};

/** Derive the parsed-args type from a raw shape via Zod inference. */
export type ParsedArgs<Shape extends ZodRawShape> = z.infer<ZodObject<Shape>>;

/**
 * The shape every tool module exports. The server iterates these and
 * binds them to the live `ToolContext` via `build(ctx)`.
 */
export type ToolModule<Shape extends ZodRawShape> = {
  name: string;
  description: string;
  inputShape: Shape;
  build(ctx: ToolContext): (args: ParsedArgs<Shape>) => Promise<CallToolResult>;
};
