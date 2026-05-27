import {
  browserFillFormShape,
  ToolNames,
  type BrowserFillFormInput,
} from "../../schema/tools.js";
import { ok, safeHandler } from "../result.js";
import type { ToolModule } from "../types.js";

export const browserFillFormTool: ToolModule<typeof browserFillFormShape> = {
  name: ToolNames.browserFillForm,
  description:
    "Batch-fill multiple form fields (inputs, selects, checkboxes, radios) in one call. Each field needs a `ref` from the latest snapshot and a `value`; pass `kind` to disambiguate non-input controls. Token-efficient alternative to a sequence of `type` calls. Invalidates all refs on success.",
  inputShape: browserFillFormShape,
  build(ctx) {
    return safeHandler(async (args: BrowserFillFormInput) => {
      const engine = ctx.registry.engineFor(args.session_id);
      await engine.fillForm(
        {
          id: args.session_id,
          platform: ctx.registry.platformOf(args.session_id),
        },
        args.fields,
      );
      return ok({ filled: args.fields.length });
    });
  },
};
